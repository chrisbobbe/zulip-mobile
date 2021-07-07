import * as logging from '../../utils/logging';

import { KEY_PREFIX, REHYDRATE } from './constants'
import purgeStoredState from './purgeStoredState'
import stringify from 'json-stringify-safe'

export default function createPersistor (store, config) {
  // defaults
  let serializer;
  if (config.serialize === false) {
    serializer = (data) => data
  } else if (typeof config.serialize === 'function') {
    serializer = config.serialize
  } else {
    serializer = defaultSerializer
  }

  let deserializer;
  if (config.deserialize === false) {
    deserializer = (data) => data
  } else if (typeof config.deserialize === 'function') {
    deserializer = config.deserialize
  } else {
    deserializer = defaultDeserializer
  }
  const blacklist = config.blacklist || []
  const whitelist = config.whitelist || false
  const keyPrefix = config.keyPrefix !== undefined ? config.keyPrefix : KEY_PREFIX

  const storage = config.storage;

  // initialize stateful values
  let lastWrittenState = {}
  let paused = false
  let writeInProgress = false

  store.subscribe(() => {
    if (paused || writeInProgress) return;

    writeOnce(store.getState());
  })

  /**
   * Update the storage to the given state.
   *
   * The storage is assumed to already reflect `lastWrittenState`.
   * On completion, sets `lastWrittenState` to `state`.
   */
  async function writeOnce(state) {
    writeInProgress = true

    const updatedSubstates = []

    Object.keys(state).forEach((key) => {
      if (!passWhitelistBlacklist(key)) return
      if (lastWrittenState[key] === state[key]) return
      updatedSubstates.push([key, state[key]])
    });

    const writes = []
    while (updatedSubstates.length > 0) {
      await new Promise(r => setTimeout(r, 0));

      const [key, substate] = updatedSubstates.shift()
      writes.push([key, serializer(substate)])
    }

    try {
      // Warning: not guaranteed to be done in a transaction.
      await storage.multiSet(
        writes.map(([key, serializedSubstate]) => [createStorageKey(key), serializedSubstate])
      )
    } catch (e) {
      warnIfSetError(updatedSubstates)(e)
      throw e
    }

    writeInProgress = false
    lastWrittenState = state
  }

  function passWhitelistBlacklist (key) {
    if (whitelist && whitelist.indexOf(key) === -1) return false
    if (blacklist.indexOf(key) !== -1) return false
    return true
  }

  function adhocRehydrate (incoming, options = {}) {
    let state = {}
    if (options.serial) {
      Object.keys(incoming).forEach((key) => {
        const subState = incoming[key]
        try {
          let data = deserializer(subState)
          let value = data
          state[key] = value
        } catch (err) {
          logging.warn('Error rehydrating data for a key', { key, err })
        }
      })
    } else state = incoming

    store.dispatch(rehydrateAction(state))
    return state
  }

  function createStorageKey (key) {
    return `${keyPrefix}${key}`
  }

  // return `persistor`
  return {
    rehydrate: adhocRehydrate,
    pause: () => { paused = true },
    resume: () => { paused = false },
    purge: (keys) => purgeStoredState({storage, keyPrefix}, keys),

    // Only used in `persistStore`, to force `lastState` to update
    // with the results of `REHYDRATE` even when the persistor is
    // paused.
    _resetLastState: () => { lastWrittenState = store.getState() }
  }
}

function warnIfSetError (updatedSubstates) {
  return function setError (err) {
    if (err) {
      logging.warn(
        'An error (below) was encountered while trying to persist this set of keys:',
        updatedSubstates.map(([key]) => key).join(', ')
      );
      logging.warn(err);
    }
  }
}

function defaultSerializer (data) {
  return stringify(data, null, null, (k, v) => {
    if (process.env.NODE_ENV !== 'production') return null
    throw new Error(`
      redux-persist: cannot process cyclical state.
      Consider changing your state structure to have no cycles.
      Alternatively blacklist the corresponding reducer key.
      Cycle encounted at key "${k}" with value "${v}".
    `)
  })
}

function defaultDeserializer (serial) {
  return JSON.parse(serial)
}

function rehydrateAction (data) {
  return {
    type: REHYDRATE,
    payload: data
  }
}
