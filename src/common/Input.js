/* @flow strict-local */
import React, { PureComponent } from 'react';
import { TextInput, Platform } from 'react-native';
import { FormattedMessage } from 'react-intl';

import type { LocalizableText } from '../types';
import type { ThemeColors } from '../styles';
import { ThemeContext, HALF_COLOR, BORDER_COLOR } from '../styles';

export type Props = $ReadOnly<{|
  ...$PropertyType<TextInput, 'props'>,
  placeholder: LocalizableText,
  onChangeText?: (text: string) => void,
  textInputRef?: (component: ?TextInput) => void,
|}>;

type State = {|
  isFocused: boolean,
|};

/**
 * A light abstraction over the standard TextInput component
 * that allows us to seamlessly provide internationalization
 * capabilities and also style the component depending on
 * the platform the app is running on.
 *
 * @prop [style] - Can override our default style for inputs.
 * @prop placeholder - Translated before passing to TextInput as
 *   a prop of the same name.
 * @prop [textInputRef] - Passed to TextInput in `ref`.  See upstream docs
 *   on refs: https://reactjs.org/docs/refs-and-the-dom.html
 * @prop ...all other TextInput props - Passed through verbatim to TextInput.
 *   See upstream: https://facebook.github.io/react-native/docs/textinput
 */
export default class Input extends PureComponent<Props, State> {
  static contextType = ThemeContext;
  context: ThemeColors;

  styles = {
    input: {
      ...Platform.select({
        ios: {
          borderWidth: 1,
          borderColor: BORDER_COLOR,
          borderRadius: 2,
          padding: 8,
        },
      }),
    },
  };

  state = {
    isFocused: false,
  };
  textInput: ?TextInput;

  handleClear = () => {
    const { onChangeText } = this.props;
    if (onChangeText) {
      onChangeText('');
    }
    if (this.textInput) {
      this.textInput.clear();
    }
  };

  handleFocus = () => {
    this.setState({
      isFocused: true,
    });
  };

  handleBlur = () => {
    this.setState({
      isFocused: false,
    });
  };

  render() {
    const { style, placeholder, textInputRef, ...restProps } = this.props;
    const { isFocused } = this.state;
    const fullPlaceholder =
      typeof placeholder === 'object' /* force linebreak */
        ? placeholder
        : { text: placeholder, values: undefined };

    return (
      <FormattedMessage
        id={fullPlaceholder.text}
        defaultMessage={fullPlaceholder.text}
        values={fullPlaceholder.values}
      >
        {(text: string) => (
          <TextInput
            style={[this.styles.input, { color: this.context.color }, style]}
            placeholder={text}
            placeholderTextColor={HALF_COLOR}
            underlineColorAndroid={isFocused ? BORDER_COLOR : HALF_COLOR}
            onFocus={this.handleFocus}
            onBlur={this.handleBlur}
            ref={(component: ?TextInput) => {
              this.textInput = component;
              if (textInputRef) {
                textInputRef(component);
              }
            }}
            {...restProps}
          />
        )}
      </FormattedMessage>
    );
  }
}
