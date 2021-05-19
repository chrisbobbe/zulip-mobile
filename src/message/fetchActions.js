/* @flow strict-local */
import * as logging from '../utils/logging';
import * as NavigationService from '../nav/NavigationService';
import type { Narrow, Dispatch, GetState, GlobalState, Message, Action, UserId } from '../types';
import type { ApiResponseServerSettings } from '../api/settings/getServerSettings';
import type { InitialData } from '../api/initialDataTypes';
import * as api from '../api';
import { resetToAccountPicker } from '../actions';
import { isClientError, isServerError } from '../api/apiErrors';
import {
  getAuth,
  getSession,
  getFirstMessageId,
  getLastMessageId,
  getCaughtUpForNarrow,
  getFetchingForNarrow,
} from '../selectors';
import config from '../config';
import {
  INITIAL_FETCH_START,
  INITIAL_FETCH_COMPLETE,
  INITIAL_FETCH_ABORT,
  MESSAGE_FETCH_START,
  MESSAGE_FETCH_ERROR,
  MESSAGE_FETCH_COMPLETE,
} from '../actionConstants';
import { FIRST_UNREAD_ANCHOR, LAST_MESSAGE_ANCHOR } from '../anchor';
import { ALL_PRIVATE_NARROW, apiNarrowOfNarrow } from '../utils/narrow';
import { BackoffMachine, promiseTimeout, TimeoutError } from '../utils/async';
import { initNotifications } from '../notification/notificationActions';
import { addToOutbox, sendOutbox } from '../outbox/outboxActions';
import { realmInit } from '../realm/realmActions';
import { startEventPolling } from '../events/eventActions';
import { logout } from '../account/accountActions';
import { ZulipVersion } from '../utils/zulipVersion';
import { getAllUsersById, getOwnUserId } from '../users/userSelectors';
import { MIN_RECENTPMS_SERVER_VERSION } from '../pm-conversations/pmConversationsModel';

const messageFetchStart = (narrow: Narrow, numBefore: number, numAfter: number): Action => ({
  type: MESSAGE_FETCH_START,
  narrow,
  numBefore,
  numAfter,
});

const messageFetchError = (args: {| narrow: Narrow, error: Error |}): Action => {
  const { narrow, error } = args;
  return {
    type: MESSAGE_FETCH_ERROR,
    narrow,
    error,
  };
};

const messageFetchComplete = (args: {|
  messages: Message[],
  narrow: Narrow,
  anchor: number,
  numBefore: number,
  numAfter: number,
  foundNewest?: boolean,
  foundOldest?: boolean,
  ownUserId: UserId,
|}): Action => {
  const {
    messages,
    narrow,
    anchor,
    numBefore,
    numAfter,
    foundNewest,
    foundOldest,
    ownUserId,
  } = args;
  return {
    type: MESSAGE_FETCH_COMPLETE,
    messages,
    narrow,
    anchor,
    numBefore,
    numAfter,
    foundNewest,
    foundOldest,
    ownUserId,
  };
};

/**
 * Get and return messages from the network, keeping Redux up-to-date.
 *
 * The returned Promise resolves with the messages, or rejects on a
 * failed network request or any failure to process data and get it
 * stored in Redux. If it rejects, it tells Redux about it.
 */
export const fetchMessages = (fetchArgs: {|
  narrow: Narrow,
  anchor: number,
  numBefore: number,
  numAfter: number,
|}) => async (dispatch: Dispatch, getState: GetState): Promise<Message[]> => {
  dispatch(messageFetchStart(fetchArgs.narrow, fetchArgs.numBefore, fetchArgs.numAfter));
  try {
    const { messages, found_newest, found_oldest } =
      // TODO: If `MESSAGE_FETCH_ERROR` isn't the right way to respond
      // to a timeout, maybe make a new action.
      // eslint-disable-next-line no-use-before-define
      await tryFetch(() =>
        api.getMessages(getAuth(getState()), {
          ...fetchArgs,
          narrow: apiNarrowOfNarrow(fetchArgs.narrow, getAllUsersById(getState())),
          useFirstUnread: fetchArgs.anchor === FIRST_UNREAD_ANCHOR, // TODO: don't use this; see #4203
        }),
      );
    dispatch(
      messageFetchComplete({
        ...fetchArgs,
        messages,
        foundNewest: found_newest,
        foundOldest: found_oldest,
        ownUserId: getOwnUserId(getState()),
      }),
    );
    return messages;
  } catch (e) {
    dispatch(
      messageFetchError({
        narrow: fetchArgs.narrow,
        error: e,
      }),
    );
    throw e;
  }
};

export const fetchOlder = (narrow: Narrow) => (dispatch: Dispatch, getState: GetState) => {
  const state = getState();
  const firstMessageId = getFirstMessageId(state, narrow);
  const caughtUp = getCaughtUpForNarrow(state, narrow);
  const fetching = getFetchingForNarrow(state, narrow);
  const { needsInitialFetch } = getSession(state);

  if (!needsInitialFetch && !fetching.older && !caughtUp.older && firstMessageId !== undefined) {
    dispatch(
      fetchMessages({
        narrow,
        anchor: firstMessageId,
        numBefore: config.messagesPerRequest,
        numAfter: 0,
      }),
    );
  }
};

export const fetchNewer = (narrow: Narrow) => (dispatch: Dispatch, getState: GetState) => {
  const state = getState();
  const lastMessageId = getLastMessageId(state, narrow);
  const caughtUp = getCaughtUpForNarrow(state, narrow);
  const fetching = getFetchingForNarrow(state, narrow);
  const { needsInitialFetch } = getSession(state);

  if (!needsInitialFetch && !fetching.newer && !caughtUp.newer && lastMessageId !== undefined) {
    dispatch(
      fetchMessages({
        narrow,
        anchor: lastMessageId,
        numBefore: 0,
        numAfter: config.messagesPerRequest,
      }),
    );
  }
};

const initialFetchStart = (): Action => ({
  type: INITIAL_FETCH_START,
});

const initialFetchComplete = (): Action => ({
  type: INITIAL_FETCH_COMPLETE,
});

const initialFetchAbortPlain = (): Action => ({
  type: INITIAL_FETCH_ABORT,
});

export const initialFetchAbort = () => async (dispatch: Dispatch, getState: GetState) => {
  NavigationService.dispatch(resetToAccountPicker());
  dispatch(initialFetchAbortPlain());
};

/** Private; exported only for tests. */
export const isFetchNeededAtAnchor = (
  state: GlobalState,
  narrow: Narrow,
  anchor: number,
): boolean => {
  // Ideally this would detect whether, even if we don't have *all* the
  // messages in the narrow, we have enough of them around the anchor
  // to show a message list already.  For now it's simple and cautious.
  const caughtUp = getCaughtUpForNarrow(state, narrow);
  return !(caughtUp.newer && caughtUp.older);
};

/**
 * Fetch messages in the given narrow, around the given anchor.
 *
 * For almost all types of data we need from the server, the magic of the
 * Zulip event system provides us a complete, updating view of all the data
 * we could want.  For background and links to docs, see `MessagesState` and
 * `doInitialFetch`.
 *
 * Message data is the one major exception, where as a result we have to go
 * fetch more data from the server as the user navigates around.
 *
 * This is the main function used for that, especially as the user navigates
 * to a given narrow.
 *
 * See also the `message` event and corresponding `EVENT_NEW_MESSAGE`
 * action, which is how we learn about new messages in real time.
 *
 * See also handlers for the `MESSAGE_FETCH_COMPLETE` action, which this
 * dispatches with the data it receives from the server.
 */
export const fetchMessagesInNarrow = (
  narrow: Narrow,
  anchor: number = FIRST_UNREAD_ANCHOR,
) => async (dispatch: Dispatch, getState: GetState): Promise<Message[] | void> => {
  if (!isFetchNeededAtAnchor(getState(), narrow, anchor)) {
    return undefined;
  }
  return dispatch(
    fetchMessages({
      narrow,
      anchor,
      numBefore: config.messagesPerRequest / 2,
      numAfter: config.messagesPerRequest / 2,
    }),
  );
};

/**
 * Fetch the few most recent PMs.
 *
 * For old servers, we do this eagerly in `doInitialFetch`, in order to
 * let us show something useful in the PM conversations screen.
 * Zulip Server 2.1 added a custom-made API to help us do this better;
 * see #3133.
 *
 * See `fetchMessagesInNarrow` for further background.
 */
// TODO(server-2.1): Delete this.
const fetchPrivateMessages = () => async (dispatch: Dispatch, getState: GetState) => {
  const auth = getAuth(getState());
  const { messages, found_newest, found_oldest } = await api.getMessages(auth, {
    narrow: apiNarrowOfNarrow(ALL_PRIVATE_NARROW, getAllUsersById(getState())),
    anchor: LAST_MESSAGE_ANCHOR,
    numBefore: 100,
    numAfter: 0,
  });
  dispatch(
    messageFetchComplete({
      messages,
      narrow: ALL_PRIVATE_NARROW,
      anchor: LAST_MESSAGE_ANCHOR,
      numBefore: 100,
      numAfter: 0,
      foundNewest: found_newest,
      foundOldest: found_oldest,
      ownUserId: getOwnUserId(getState()),
    }),
  );
};

/**
 * Makes a request that retries until success or a non-5xx error;
 *   times out after `config.requestLongTimeoutMs`.
 *
 * Waits between retries with a backoff.
 *
 * A non-5xx error (such as a 4xx error or any non-API error) is
 * considered an unrecoverable failure, and it will propagate to the
 * caller to be handled.
 *
 * The timeout is absolute: it triggers after that time has elapsed no
 * matter whether the time was spent waiting to hear back from one
 * request, or retrying a request unsuccessfully many times (and the
 * time spent in backoff is included in that).
 */
export async function tryFetch<T>(func: () => Promise<T>): Promise<T> {
  const backoffMachine = new BackoffMachine();

  // TODO: Use AbortController instead of this stateful flag; #4170
  let timerHasExpired = false;

  try {
    return await promiseTimeout(
      (async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (timerHasExpired) {
            // No one is listening for this Promise to settle, so stop
            // doing more work.
            throw new Error();
          }
          try {
            return await func();
          } catch (e) {
            if (!isServerError(e)) {
              throw e;
            }
          }
          await backoffMachine.wait();
        }
      })(),
      config.requestLongTimeoutMs,
    );
  } catch (e) {
    if (e instanceof TimeoutError) {
      timerHasExpired = true;
    }
    throw e;
  }
}

/**
 * Fetch lots of state from the server, and start an event queue.
 *
 * This is where we set up our use of the Zulip event system for real-time
 * updates, calling its `/register` endpoint and starting an async loop to
 * poll for events.  For background on the Zulip event system and how we use
 * it, see docs from the client-side perspective:
 *   https://github.com/zulip/zulip-mobile/blob/master/docs/architecture/realtime.md
 * and a mainly server-side perspective:
 *   https://zulip.readthedocs.io/en/latest/subsystems/events-system.html
 *
 * Also do some miscellaneous other work we want to do when starting
 * up, or regaining a network connection. We fetch private messages
 * here so that we can show something useful in the PM conversations
 * screen, but we hope to stop doing this soon (see note at
 * `fetchPrivateMessages`). We fetch messages in a few other places:
 * to initially populate a message list (`ChatScreen`), to grab more
 * messages on scrolling to the top or bottom of the message list
 * (`fetchOlder` and `fetchNewer`), and to grab search results
 * (`SearchMessagesScreen`).
 */
export const doInitialFetch = () => async (dispatch: Dispatch, getState: GetState) => {
  dispatch(initialFetchStart());
  const auth = getAuth(getState());

  let initData: InitialData;
  let serverSettings: ApiResponseServerSettings;

  try {
    [initData, serverSettings] = await Promise.all([
      promiseTimeout(
        api.registerForEvents(auth, {
          fetch_event_types: config.serverDataOnStartup,
          apply_markdown: true,
          include_subscribers: false,
          client_gravatar: true,
          client_capabilities: {
            notification_settings_null: true,
            bulk_message_deletion: true,
            user_avatar_url_field_optional: true,
          },
        }),
        config.requestLongTimeoutMs,
      ),
      promiseTimeout(api.getServerSettings(auth.realm), config.requestLongTimeoutMs),
    ]);
  } catch (e) {
    if (isClientError(e)) {
      // This should only happen when `auth` is no longer valid. No
      // use retrying; just log out.
      dispatch(logout());
    } else if (isServerError(e) || e instanceof TimeoutError) {
      dispatch(initialFetchAbort());
    } else {
      logging.warn(e, {
        message: 'Unexpected error during initial fetch and serverSettings fetch.',
      });
    }
    return;
  }

  const serverVersion = new ZulipVersion(serverSettings.zulip_version);
  dispatch(realmInit(initData, serverVersion));
  dispatch(initialFetchComplete());
  dispatch(startEventPolling(initData.queue_id, initData.last_event_id));

  if (!serverVersion.isAtLeast(MIN_RECENTPMS_SERVER_VERSION)) {
    dispatch(fetchPrivateMessages());
  }

  dispatch(sendOutbox());
  dispatch(initNotifications());
};

export const uploadFile = (narrow: Narrow, uri: string, name: string) => async (
  dispatch: Dispatch,
  getState: GetState,
) => {
  const auth = getAuth(getState());
  const response = await api.uploadFile(auth, uri, name);
  const messageToSend = `[${name}](${response.uri})`;

  dispatch(addToOutbox(narrow, messageToSend));
};
