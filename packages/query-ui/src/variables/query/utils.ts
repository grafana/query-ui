import { isNumber, sortBy, toLower, uniqBy } from 'lodash';
import {
  stringToJsRegex,
  VariableSort,
  type VariableRegexApplyTo,
} from '@grafana/data';
import type { DataQuery } from '@grafana/schema';

import { SEARCH_FILTER_VARIABLE } from '../constants';
import type { VariableValueOption } from '../types';
import type { MetricFindValueWithProperties } from './toMetricFindValues';

export type StaticOptionsOrder = 'before' | 'after' | 'sorted';

interface MetricNamesToVariableValuesArgs {
  variableRegEx: string;
  variableRegexApplyTo: VariableRegexApplyTo;
  sort: VariableSort;
  metricNames: MetricFindValueWithProperties[];
}

export function metricNamesToVariableValues({
  variableRegEx,
  variableRegexApplyTo,
  sort,
  metricNames,
}: MetricNamesToVariableValuesArgs): VariableValueOption[] {
  let regex: RegExp | undefined;
  let options: VariableValueOption[] = [];

  if (variableRegEx) {
    regex = stringToJsRegex(variableRegEx);
  }

  for (const item of metricNames) {
    let text: string | number | undefined = item.text ?? item.value ?? '';
    let value: string | number | undefined = item.value ?? item.text ?? '';

    if (isNumber(value)) {
      value = value.toString();
    }

    if (isNumber(text)) {
      text = text.toString();
    }

    if (regex) {
      const applyTo = String(variableRegexApplyTo === 'text' ? text : value);
      const matches = getAllMatches(applyTo, regex);
      if (!matches.length) {
        continue;
      }

      const valueGroup = matches.find((m) => m.groups && m.groups.value);
      const textGroup = matches.find((m) => m.groups && m.groups.text);
      const firstMatch = matches.find((m) => m.length > 1);
      const manyMatches = matches.length > 1 && firstMatch;

      if (valueGroup || textGroup) {
        value = valueGroup?.groups?.value ?? textGroup?.groups?.text;
        text = textGroup?.groups?.text ?? valueGroup?.groups?.value;
      } else if (manyMatches) {
        for (const match of matches) {
          options.push({ label: match[1], value: match[1] });
        }
        continue;
      } else if (firstMatch) {
        text = firstMatch[1];
        value = firstMatch[1];
      }
    }

    options.push({
      label: String(text),
      value: value as string,
      properties: item.properties,
    });
  }

  options = uniqBy(options, 'value');
  return sortVariableValues(options, sort);
}

/**
 * Merges static options with the options returned by the query.
 * A static option replaces a query option with the same value.
 */
export function mergeStaticOptions(
  options: VariableValueOption[],
  staticOptions: VariableValueOption[] | undefined,
  order: StaticOptionsOrder | undefined,
  sort: VariableSort,
): VariableValueOption[] {
  if (!staticOptions) {
    return options;
  }

  const unique = options.filter(
    (option) => !staticOptions.some((custom) => custom.value === option.value),
  );

  if (order === 'after') {
    return [...unique, ...staticOptions];
  }

  if (order === 'sorted') {
    return sortVariableValues(unique.concat(staticOptions), sort);
  }

  return [...staticOptions, ...unique];
}

/**
 * Whether the query references the `__searchFilter` variable, and so can
 * narrow its results to what the user types. Only such a query is run again
 * as the search changes.
 */
export function containsSearchFilter(query: string | DataQuery): boolean {
  const text = typeof query === 'string' ? query : JSON.stringify(query);

  return text.includes(SEARCH_FILTER_VARIABLE);
}

const getAllMatches = (str: string, regex: RegExp): RegExpExecArray[] => {
  const results: RegExpExecArray[] = [];

  regex.lastIndex = 0;

  let match = regex.exec(str);
  while (match) {
    results.push(match);

    if (!regex.global || match[0] === '' || match[0] === undefined) {
      break;
    }

    match = regex.exec(str);
  }

  return results;
};

export const sortVariableValues = (
  options: VariableValueOption[],
  sortOrder: VariableSort,
) => {
  if (sortOrder === VariableSort.disabled) {
    return options;
  }

  switch (sortOrder) {
    case VariableSort.alphabeticalAsc:
      options = sortBy(options, 'label');
      break;
    case VariableSort.alphabeticalDesc:
      options = sortBy(options, 'label').reverse();
      break;
    case VariableSort.numericalAsc:
      options = sortBy(options, sortByNumeric);
      break;
    case VariableSort.numericalDesc:
      options = sortBy(options, sortByNumeric);
      options = options.reverse();
      break;
    case VariableSort.alphabeticalCaseInsensitiveAsc:
      options = sortBy(options, (opt) => {
        return toLower(opt.label);
      });
      break;
    case VariableSort.alphabeticalCaseInsensitiveDesc:
      options = sortBy(options, (opt) => {
        return toLower(opt.label);
      });
      options = options.reverse();
      break;
    case VariableSort.naturalAsc:
      // Sort by natural sort
      options = sortByNaturalSort(options);
      break;
    case VariableSort.naturalDesc:
      options = sortByNaturalSort(options);
      options = options.reverse();
      break;
    default:
      break;
  }
  return options;
};

function sortByNumeric(opt: VariableValueOption) {
  if (!opt.label) {
    return -1;
  }
  const matches = opt.label.match(/.*?(\d+).*/);
  if (!matches || matches.length < 2) {
    return -1;
  } else {
    return parseInt(matches[1], 10);
  }
}

const collator = new Intl.Collator(undefined, {
  sensitivity: 'accent',
  numeric: true,
});

function sortByNaturalSort(options: VariableValueOption[]) {
  return options.slice().sort((a, b) => {
    return collator.compare(a.label, b.label);
  });
}
