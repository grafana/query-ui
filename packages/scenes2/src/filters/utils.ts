import type { AdHocVariableFilter } from '@grafana/data';

export function safeStringifyValue(value: unknown) {
  // Avoid circular references ignoring those references
  const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (_: string, value: object | null) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }
      return value;
    };
  };

  try {
    return JSON.stringify(value, getCircularReplacer());
  } catch (error) {
    console.error(error);
  }

  return '';
}

export function renderPrometheusLabelFilters(filters: AdHocVariableFilter[]) {
  return filters.map((filter) => renderFilter(filter)).join(',');
}

function renderFilter(filter: AdHocVariableFilter) {
  let value: string | undefined;
  let operator = filter.operator;

  // map "one of" operator to regex
  if (operator === '=|') {
    operator = '=~';
    // TODO remove when we're on the latest version of @grafana/data
    value = filter.values?.map(escapeLabelValueInRegexSelector).join('|');
  } else if (operator === '!=|') {
    operator = '!~';
    // TODO remove when we're on the latest version of @grafana/data
    value = filter.values?.map(escapeLabelValueInRegexSelector).join('|');
  } else if (operator === '=~' || operator === '!~') {
    value = escapeLabelValueInRegexSelector(filter.value);
  } else {
    value = escapeLabelValueInExactSelector(filter.value);
  }

  return `${filter.key}${operator}"${value}"`;
}

// based on the openmetrics-documentation, the 3 symbols we have to handle are:
// - \n ... the newline character
// - \  ... the backslash character
// - "  ... the double-quote character
export function escapeLabelValueInExactSelector(labelValue: string): string {
  return labelValue
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

export function escapeLabelValueInRegexSelector(labelValue: string): string {
  return escapeLabelValueInExactSelector(escapeLokiRegexp(labelValue));
}

export function isRegexSelector(selector?: string) {
  if (selector && (selector.includes('=~') || selector.includes('!~'))) {
    return true;
  }
  return false;
}

// Loki regular-expressions use the RE2 syntax (https://github.com/google/re2/wiki/Syntax),
// so every character that matches something in that list has to be escaped.
// the list of meta characters is: *+?()|\.[]{}^$
// we make a javascript regular expression that matches those characters:
const RE2_METACHARACTERS = /[*+?()|\\.\[\]{}^$]/g;
function escapeLokiRegexp(value: string): string {
  return value.replace(RE2_METACHARACTERS, '\\$&');
}

export function escapeUrlPipeDelimiters(value: string | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Replace the pipe due to using it as a filter separator
  return (value = /\|/g[Symbol.replace](value, '__gfp__'));
}

export function escapeUrlCommaDelimiters(value: string | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Replace the comma due to using it as a value/label separator
  return /,/g[Symbol.replace](value, '__gfc__');
}

export function escapeUrlHashDelimiters(value: string | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Replace the hash due to using it as a value/label separator
  return /#/g[Symbol.replace](value, '__gfh__');
}

export function escapeOriginFilterUrlDelimiters(
  value: string | undefined,
): string {
  return escapeUrlHashDelimiters(escapeUrlPipeDelimiters(value));
}

export function escapeURLDelimiters(value: string | undefined): string {
  return escapeUrlCommaDelimiters(escapeUrlPipeDelimiters(value));
}

export function unescapeUrlDelimiters(value: string | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  value = /__gfp__/g[Symbol.replace](value, '|');
  value = /__gfc__/g[Symbol.replace](value, ',');
  value = /__gfh__/g[Symbol.replace](value, '#');

  return value;
}

export function toUrlCommaDelimitedString(key: string, label?: string): string {
  // Omit for identical key/label or when label is not set at all
  if (!label || key === label) {
    return escapeUrlCommaDelimiters(key);
  }

  return [key, label].map(escapeUrlCommaDelimiters).join(',');
}
