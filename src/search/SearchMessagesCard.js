/* @flow strict-local */

import React, { PureComponent } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Message } from '../types';
import { createStyleSheet } from '../styles';
import { LoadingIndicator, SearchEmptyState } from '../common';
import { HOME_NARROW } from '../utils/narrow';
import MessageList from '../webview/MessageList';

const styles = createStyleSheet({
  results: {
    flex: 1,
  },
});

type Props = $ReadOnly<{|
  messages: Message[] | null,
  isFetching: boolean,
|}>;

export default class SearchMessagesCard extends PureComponent<Props> {
  render() {
    const { isFetching, messages } = this.props;

    if (isFetching) {
      // Display loading indicator only if there are no messages to
      // display from a previous search.
      if (!messages || messages.length === 0) {
        return <LoadingIndicator size={40} />;
      }
    }

    if (!messages) {
      return null;
    }

    if (messages.length === 0) {
      return <SearchEmptyState text="No results" />;
    }

    // TODO: This is kind of a hack.
    const narrow = HOME_NARROW;

    return (
      // TODO: Keep the meaningful content within the safe areas, but
      // let the background elements extend through the insets all the
      // way to the left and right of the screen.
      <SafeAreaView mode="padding" edges={['right', 'left']} style={styles.results}>
        <MessageList
          initialScrollMessageId={
            // This access is OK only because of the `.length === 0` check
            // above.
            messages[messages.length - 1].id
          }
          messages={messages}
          narrow={narrow}
          showMessagePlaceholders={false}
          // TODO: handle editing a message from the search results,
          // or make this prop optional
          startEditMessage={() => undefined}
        />
      </SafeAreaView>
    );
  }
}
