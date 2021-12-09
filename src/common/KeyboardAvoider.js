/* @flow strict-local */
import React, { PureComponent } from 'react';
import type { Node } from 'react';
import { Platform, View } from 'react-native';
import type { ViewStyleProp } from 'react-native/Libraries/StyleSheet/StyleSheet';

import KeyboardAvoiderIos from './KeyboardAvoiderIos';

type Props = $ReadOnly<{|
  children: Node,
  style?: ViewStyleProp,
|}>;

/**
 * Renders our `KeyboardAvoiderIos` on iOS, `View` on Android.
 */
export default class KeyboardAvoider extends PureComponent<Props> {
  render(): Node {
    const { children, style } = this.props;

    if (Platform.OS === 'android') {
      return <View style={style}>{children}</View>;
    }

    return <KeyboardAvoiderIos style={style}>{children}</KeyboardAvoiderIos>;
  }
}
