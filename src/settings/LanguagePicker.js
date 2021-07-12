/* @flow strict-local */
import React, { PureComponent } from 'react';
import { FlatList } from 'react-native';

import type { GetText } from '../types';
import { TranslationContext } from '../boot/TranslationProvider';
import { OptionDivider, SelectableOptionRow } from '../common';
import languages from './languages';
import type { Language } from './languages';

type Props = $ReadOnly<{|
  value: string,
  onValueChange: (locale: string) => void,
  filter: string,
|}>;

/**
 * A filterable list of languages to choose from, for the app UI.
 *
 * Needs to occupy the horizontal insets because its descendents (the
 * language items) do.
 */
export default class LanguagePicker extends PureComponent<Props> {
  static contextType = TranslationContext;
  context: GetText;

  getTranslatedLanguages = (): Language[] =>
    languages.map((language: Language) => {
      const _ = this.context;
      const translatedName = _(language.name);
      return {
        ...language,
        name: translatedName,
      };
    });

  getFilteredLanguageList = (filter: string): Language[] => {
    const list = this.getTranslatedLanguages();

    if (!filter) {
      return list;
    }

    return list.filter(item => {
      const itemData = `${item.name.toUpperCase()} ${item.nativeName.toUpperCase()}`;
      const filterData = filter.toUpperCase();

      return itemData.includes(filterData);
    });
  };

  render() {
    const { value, onValueChange, filter } = this.props;
    const data = this.getFilteredLanguageList(filter);

    return (
      <FlatList
        ItemSeparatorComponent={OptionDivider}
        initialNumToRender={languages.length}
        data={data}
        keyboardShouldPersistTaps="always"
        keyExtractor={item => item.locale}
        renderItem={({ item }) => (
          <SelectableOptionRow
            selected={item.locale === value}
            onRequestSelectionChange={onValueChange}
            itemKey={item.locale}
            subtitle={item.name}
            title={item.nativeName}
          />
        )}
      />
    );
  }
}
