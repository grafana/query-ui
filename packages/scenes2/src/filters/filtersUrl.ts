import type { AdHocFilterWithLabels } from './AdhocFiltersContext';
import { isMultiValueOperator } from './AdhocFiltersContext';

/**
 * How filters are written to the url, one value per filter.
 *
 * Each filter follows the format `AdHocFiltersVariable` uses in Grafana Scenes:
 * parts separated by `|`, and a label after a comma, as in
 * `key,Key label|=|value,Value label`. A multi-value operator lists its values
 * one after another: `key|=__gfp__|a,A label|b,B label`. Every part is
 * escaped, so the `|` in the operator `=|` never reads as a separator.
 *
 * Origin filters, which Scenes writes after a `#`, are not part of the context.
 * The `#` is still escaped so that the two formats stay compatible.
 */
const partSeparator = '|';
const labelSeparator = ',';

/** What each delimiter becomes inside a key, value or label. */
const escapes: ReadonlyArray<readonly [string, string]> = [
  [partSeparator, '__gfp__'],
  [labelSeparator, '__gfc__'],
  ['#', '__gfh__'],
];

function escapeDelimiters(text: string): string {
  return escapes.reduce((result, [char, token]) => {
    return result.split(char).join(token);
  }, text);
}

function unescapeDelimiters(text: string): string {
  return escapes.reduce((result, [char, token]) => {
    return result.split(token).join(char);
  }, text);
}

/** `text`, followed by `label` when there is one that differs from it. */
function withLabel(text: string, label: string | undefined): string {
  if (!label || label === text) {
    return escapeDelimiters(text);
  }

  return `${escapeDelimiters(text)}${labelSeparator}${escapeDelimiters(label)}`;
}

/** Whether the filter has everything it needs to be applied. */
function isComplete(filter: AdHocFilterWithLabels): boolean {
  if (!filter.key || !filter.operator) {
    return false;
  }

  return isMultiValueOperator(filter.operator)
    ? Boolean(filter.values?.length)
    : filter.value !== '';
}

function serializeFilter(filter: AdHocFilterWithLabels): string {
  const parts = [
    withLabel(filter.key, filter.keyLabel),
    escapeDelimiters(filter.operator),
  ];

  if (isMultiValueOperator(filter.operator)) {
    (filter.values ?? []).forEach((value, index) => {
      parts.push(withLabel(value, filter.valueLabels?.[index]));
    });
  } else {
    parts.push(withLabel(filter.value, filter.valueLabels?.[0]));
  }

  return parts.join(partSeparator);
}

/**
 * The filters as url values, one for each. Filters that are not complete are
 * left out, and so is everything the url cannot carry, like `meta`.
 */
export function serializeFilters(filters: AdHocFilterWithLabels[]): string[] {
  return filters.filter(isComplete).map(serializeFilter);
}

/** Splits `text` into the text and the label that follows its comma. */
function splitLabel(text: string): { text: string; label: string | undefined } {
  const [raw = '', label] = text.split(labelSeparator);

  return {
    text: unescapeDelimiters(raw),
    label: label === undefined ? undefined : unescapeDelimiters(label),
  };
}

function deserializeFilter(serialized: string): AdHocFilterWithLabels | null {
  // Anything after a `#` is an origin, which the context has no use for.
  const [filterPart = ''] = serialized.split('#');
  const [keyPart = '', operatorPart = '', ...valueParts] =
    filterPart.split(partSeparator);
  const operator = unescapeDelimiters(operatorPart);

  const key = splitLabel(keyPart);

  if (!key.text || !operator) {
    return null;
  }

  const values = valueParts.map(splitLabel);
  const filter: AdHocFilterWithLabels = {
    key: key.text,
    keyLabel: key.label ?? key.text,
    operator,
    value: values[0]?.text ?? '',
    valueLabels: values.map((value) => value.label ?? value.text),
  };

  if (isMultiValueOperator(operator)) {
    filter.values = values.map((value) => value.text);
  }

  return filter;
}

/** The filters in the url values, leaving out any entry that does not parse. */
export function deserializeFilters(
  values: readonly string[],
): AdHocFilterWithLabels[] {
  return values
    .map(deserializeFilter)
    .filter((filter): filter is AdHocFilterWithLabels => filter !== null);
}
