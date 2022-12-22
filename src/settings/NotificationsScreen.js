/* @flow strict-local */

import React, { useCallback } from 'react';
import type { Node } from 'react';
import { Platform, Linking, NativeModules } from 'react-native';
import OpenNotification from 'react-native-open-notification';

import type { RouteProp } from '../react-navigation';
import type { AppNavigationProp } from '../nav/AppNavigator';
import { useSelector } from '../react-redux';
import { getAuth, getSettings } from '../selectors';
import SwitchRow from '../common/SwitchRow';
import Screen from '../common/Screen';
import * as api from '../api';
import ServerPushSetupBanner from '../common/ServerPushSetupBanner';
import NestedNavRow from '../common/NestedNavRow';

type Props = $ReadOnly<{|
  navigation: AppNavigationProp<'notifications'>,
  route: RouteProp<'notifications', void>,
|}>;

/** (NB this is a per-account screen -- these are per-account settings.) */
export default function NotificationsScreen(props: Props): Node {
  const auth = useSelector(getAuth);
  const offlineNotification = useSelector(state => getSettings(state).offlineNotification);
  const onlineNotification = useSelector(state => getSettings(state).onlineNotification);
  const streamNotification = useSelector(state => getSettings(state).streamNotification);

  const handleSystemNotificationsPress = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL(
        // Link directly to notification settings when iOS supports it
        // (15.4+). Otherwise, link to the regular settings, and the user
        // will have to tap through to notification settings.
        // TODO(ios-15.4): Remove fallback.
        NativeModules.ZLPConstants.UIApplicationOpenNotificationSettingsURLString
          ?? NativeModules.ZLPConstants.UIApplicationOpenSettingsURLString,
      );
    } else {
      // On iOS, react-native-open-notification doesn't support opening
      // all the way to *notification* settings. It does support that on
      // Android, so we use it here.
      OpenNotification.open();
    }
  }, []);

  // TODO(#3999): It'd be good to show "working on it" UI feedback while a
  //   request is pending, after the user touches a switch.

  const handleOfflineNotificationChange = useCallback(() => {
    api.toggleMobilePushSettings({
      auth,
      opp: 'offline_notification_change',
      value: !offlineNotification,
    });
  }, [offlineNotification, auth]);

  const handleOnlineNotificationChange = useCallback(() => {
    api.toggleMobilePushSettings({
      auth,
      opp: 'online_notification_change',
      value: !onlineNotification,
    });
  }, [onlineNotification, auth]);

  const handleStreamNotificationChange = useCallback(() => {
    api.toggleMobilePushSettings({
      auth,
      opp: 'stream_notification_change',
      value: !streamNotification,
    });
  }, [streamNotification, auth]);

  return (
    <Screen title="Notifications">
      <ServerPushSetupBanner isDismissable={false} />
      <NestedNavRow
        label="System notification settings for Zulip"
        onPress={handleSystemNotificationsPress}
      />
      <SwitchRow
        label="Notifications when offline"
        value={offlineNotification}
        onValueChange={handleOfflineNotificationChange}
      />
      <SwitchRow
        label="Notifications when online"
        value={onlineNotification}
        onValueChange={handleOnlineNotificationChange}
      />
      <SwitchRow
        label="Stream notifications"
        value={streamNotification}
        onValueChange={handleStreamNotificationChange}
      />
    </Screen>
  );
}
