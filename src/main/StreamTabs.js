/* @flow strict-local */
import React from 'react';
import { Text } from 'react-native';
import { FormattedMessage } from 'react-intl';
import { createMaterialTopTabNavigator } from 'react-navigation';

import type { TabNavigationOptionsPropsType } from '../types';
import { createStyleSheet } from '../styles';
import tabsOptions from '../styles/tabs';
import SubscriptionsCard from '../streams/SubscriptionsCard';
import StreamListCard from '../subscriptions/StreamListCard';

const styles = createStyleSheet({
  tab: {
    padding: 8,
    fontSize: 16,
  },
});

export default createMaterialTopTabNavigator(
  {
    subscribed: {
      // $FlowFixMe `navigationOptions` property on component type
      screen: SubscriptionsCard,
      navigationOptions: {
        tabBarLabel: (props: TabNavigationOptionsPropsType) => (
          <Text style={[styles.tab, { color: props.tintColor }]}>
            <FormattedMessage id="Subscribed" defaultMessage="Subscribed" />
          </Text>
        ),
      },
    },
    allStreams: {
      // $FlowFixMe `navigationOptions` property on component type
      screen: StreamListCard,
      navigationOptions: {
        tabBarLabel: (props: TabNavigationOptionsPropsType) => (
          <Text style={[styles.tab, { color: props.tintColor }]}>
            <FormattedMessage id="All streams" defaultMessage="All streams" />
          </Text>
        ),
      },
    },
  },
  {
    ...tabsOptions({
      showLabel: true,
      showIcon: false,
    }),
  },
);
