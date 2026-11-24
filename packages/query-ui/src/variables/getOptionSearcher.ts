import { t } from '@grafana/i18n';

import { ALL_VARIABLE_VALUE } from './constants';
import { fuzzyFind } from './filter';
import type { VariableValueOption } from './types';

// Copied from Grafana Scenes:
// https://github.com/grafana/scenes/blob/main/packages/scenes/src/variables/components/getOptionSearcher.ts

/**
 * Returns a function that fuzzy searches the options by label, best match
 * first. With `includeAll`, an "All" option goes first.
 */
export function getOptionSearcher(
  options: VariableValueOption[],
  includeAll = false,
) {
  let allOptions = options;

  if (includeAll) {
    allOptions = [
      {
        value: ALL_VARIABLE_VALUE,
        label: t(
          'grafana-scenes.variables.variable-value-select.all-label',
          'All',
        ),
      },
      ...allOptions,
    ];
  }

  const haystack = allOptions.map((o) => o.label);

  return (search: string) =>
    fuzzyFind<VariableValueOption>(allOptions, haystack, search);
}
