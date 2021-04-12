/* @flow strict-local */
import type { Narrow, GlobalState } from '../types';
import { keyFromNarrow } from '../utils/narrow';

export const getDraftForNarrow = (state: GlobalState, narrow: Narrow): string | void =>
  state.drafts[keyFromNarrow(narrow)];
