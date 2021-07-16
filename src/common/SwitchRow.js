/* @flow strict-local */
import React, { PureComponent } from 'react';
import { View } from 'react-native';
import type { ViewStyleProp } from 'react-native/Libraries/StyleSheet/StyleSheet';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SpecificIconType } from './Icons';
import Label from './Label';
import ZulipSwitch from './ZulipSwitch';
import type { ThemeData } from '../styles';
import styles, { ThemeContext } from '../styles';

type Props = $ReadOnly<{|
  Icon?: SpecificIconType,
  label: string,
  value: boolean,
  style?: ViewStyleProp,
  onValueChange: (newValue: boolean) => void,
|}>;

/**
 * A row with a label and a switch component.
 *
 * Pads the horizontal insets with its background. (A parent component
 * could probably do this instead, if desired. The choice to do it here is
 * just in line with our other "row" components, like `SelectableOptionRow`,
 * which do need to pad the insets.)
 */
export default class SwitchRow extends PureComponent<Props> {
  static contextType = ThemeContext;
  context: ThemeData;

  styles = {
    container: {
      height: 56,
    },
  };

  render() {
    const { label, value, onValueChange, style, Icon } = this.props;

    return (
      <SafeAreaView
        mode="padding"
        edges={['right', 'left']}
        style={[this.styles.container, styles.listItem, style]}
      >
        {!!Icon && <Icon size={24} style={[styles.settingsIcon, { color: this.context.color }]} />}
        <Label text={label} style={styles.flexed} />
        <View style={styles.rightItem}>
          <ZulipSwitch value={value} onValueChange={onValueChange} />
        </View>
      </SafeAreaView>
    );
  }
}
