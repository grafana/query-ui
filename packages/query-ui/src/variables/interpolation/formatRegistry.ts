import { isArray, map, replace } from 'lodash';
import {
  Registry,
  type RegistryItem,
  textUtil,
  escapeRegex,
  dateTime,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VariableType, VariableFormatID } from '@grafana/schema';

import { ALL_VARIABLE_VALUE } from '../constants';

export type VariableValueSingle = string | number | boolean;

/** A variable value as the formatters see it: one value, or several for a multi-value variable. */
export type FormatValue = VariableValueSingle | VariableValueSingle[];

export interface FormatRegistryItem extends RegistryItem {
  formatter(
    value: FormatValue,
    args: string[],
    variable: FormatVariable,
    fieldPath?: string,
  ): string;
}

/**
 * Slimmed down version of the SceneVariable interface so that it only contains what the formatters actually use.
 * This is useful as we have some implementations of this interface that does not need to be full scene objects.
 * For example ScopedVarsVariable and LegacyVariableWrapper.
 */
export interface FormatVariable {
  name: string;
  type?: VariableType;
  isMulti?: boolean;
  includeAll?: boolean;

  getValue(fieldPath?: string): unknown;
}

export const formatRegistry = new Registry<FormatRegistryItem>(() => {
  const formats: FormatRegistryItem[] = [
    {
      id: VariableFormatID.Lucene,
      name: 'Lucene',
      description:
        'Values are lucene escaped and multi-valued variables generate an OR expression',
      formatter: (value) => {
        if (typeof value === 'string') {
          return luceneEscape(value);
        }

        if (Array.isArray(value)) {
          if (value.length === 0) {
            return '__empty__';
          }
          const quotedValues = map(value, (val: string) => {
            return '"' + luceneEscape(val) + '"';
          });
          return '(' + quotedValues.join(' OR ') + ')';
        } else {
          return luceneEscape(`${value}`);
        }
      },
    },
    {
      id: VariableFormatID.Raw,
      name: 'raw',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.keep-value-as-is',
        'Keep value as is',
      ),
      formatter: (value) => String(value),
    },
    {
      id: VariableFormatID.Regex,
      name: 'Regex',
      description:
        'Values are regex escaped and multi-valued variables generate a (<value>|<value>) expression',
      formatter: (value) => {
        if (typeof value === 'string') {
          return escapeRegex(value);
        }

        if (Array.isArray(value)) {
          const escapedValues = value.map((item) => {
            if (typeof item === 'string') {
              return escapeRegex(item);
            } else {
              return escapeRegex(String(item));
            }
          });

          if (escapedValues.length === 1) {
            return escapedValues[0];
          }

          return '(' + escapedValues.join('|') + ')';
        }

        return escapeRegex(`${value}`);
      },
    },
    {
      id: VariableFormatID.Pipe,
      name: 'Pipe',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.values-are-separated-by-character',
        'Values are separated by | character',
      ),
      formatter: (value) => {
        if (typeof value === 'string') {
          return value;
        }

        if (Array.isArray(value)) {
          return value.join('|');
        }

        return `${value}`;
      },
    },
    {
      id: VariableFormatID.Distributed,
      name: 'Distributed',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.multiple-values-are-formatted-like-variablevalue',
        'Multiple values are formatted like variable=value',
      ),
      formatter: (value, _, variable) => {
        if (typeof value === 'string') {
          return value;
        }

        if (Array.isArray(value)) {
          const joined = map(value, (val: string, index: number) => {
            if (index !== 0) {
              return variable.name + '=' + val;
            } else {
              return val;
            }
          });

          return joined.join(',');
        }

        return `${value}`;
      },
    },
    {
      id: VariableFormatID.CSV,
      name: 'Csv',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.commaseparated-values',
        'Comma-separated values',
      ),
      formatter: (value) => {
        if (typeof value === 'string') {
          return value;
        }

        if (isArray(value)) {
          return value.join(',');
        }

        return String(value);
      },
    },
    {
      id: VariableFormatID.HTML,
      name: 'HTML',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.html-escaping-of-values',
        'HTML escaping of values',
      ),
      formatter: (value) => {
        if (typeof value === 'string') {
          return textUtil.escapeHtml(value);
        }

        if (isArray(value)) {
          return textUtil.escapeHtml(value.join(', '));
        }

        return textUtil.escapeHtml(String(value));
      },
    },
    {
      id: VariableFormatID.JSON,
      name: 'JSON',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.json-stringify-value',
        'JSON stringify value',
      ),
      formatter: (value) => {
        if (typeof value === 'string') {
          return value;
        }
        return JSON.stringify(value);
      },
    },
    {
      id: VariableFormatID.PercentEncode,
      name: 'Percent encode',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.useful-for-url-escaping-values',
        'Useful for URL escaping values',
      ),
      formatter: (value) => {
        // like glob, but url escaped
        if (isArray(value)) {
          return encodeURIComponentStrict('{' + value.join(',') + '}');
        }

        return encodeURIComponentStrict(String(value));
      },
    },
    {
      id: VariableFormatID.SingleQuote,
      name: 'Single quote',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.single-quoted-values',
        'Single quoted values',
      ),
      formatter: (value) => {
        // escape single quotes with backslash
        const regExp = new RegExp(`'`, 'g');

        if (isArray(value)) {
          return map(
            value,
            (v: string) => `'${replace(v, regExp, `\\'`)}'`,
          ).join(',');
        }

        const strVal = typeof value === 'string' ? value : String(value);
        return `'${replace(strVal, regExp, `\\'`)}'`;
      },
    },
    {
      id: VariableFormatID.DoubleQuote,
      name: 'Double quote',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.double-quoted-values',
        'Double quoted values',
      ),
      formatter: (value) => {
        // escape double quotes with backslash
        const regExp = new RegExp('"', 'g');
        if (isArray(value)) {
          return map(
            value,
            (v: string) => `"${replace(v, regExp, '\\"')}"`,
          ).join(',');
        }

        const strVal = typeof value === 'string' ? value : String(value);
        return `"${replace(strVal, regExp, '\\"')}"`;
      },
    },
    {
      id: VariableFormatID.SQLString,
      name: 'SQL string',
      description:
        'SQL string quoting and commas for use in IN statements and other scenarios',
      formatter: sqlStringFormatter,
    },
    {
      id: 'join', // join not yet available in depended @grafana/schema version
      name: 'Join',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.join-values-with-a-comma',
        'Join values with a comma',
      ),
      formatter: (value, args) => {
        if (isArray(value)) {
          const separator = args[0] ?? ',';
          return value.join(separator);
        }
        return String(value);
      },
    },
    {
      id: VariableFormatID.Date,
      name: 'Date',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.format-date-in-different-ways',
        'Format date in different ways',
      ),
      formatter: (value, args) => {
        let nrValue = NaN;

        if (typeof value === 'number') {
          nrValue = value;
        } else if (typeof value === 'string') {
          nrValue = parseInt(value, 10);
        }

        if (isNaN(nrValue)) {
          return 'NaN';
        }

        const arg = args[0] ?? 'iso';
        switch (arg) {
          case 'ms':
            return String(value);
          case 'seconds':
            return `${Math.round(nrValue! / 1000)}`;
          case 'iso':
            return dateTime(nrValue).toISOString();
          default:
            if ((args || []).length > 1) {
              return dateTime(nrValue).format(args.join(':'));
            }
            return dateTime(nrValue).format(arg);
        }
      },
    },
    {
      id: VariableFormatID.Glob,
      name: 'Glob',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.format-multivalued-variables-using-syntax-example',
        'Format multi-valued variables using glob syntax, example {value1,value2}',
      ),
      formatter: (value) => {
        if (isArray(value) && value.length > 1) {
          return '{' + value.join(',') + '}';
        }
        return String(value);
      },
    },
    {
      id: VariableFormatID.Text,
      name: 'Text',
      description:
        'Format variables in their text representation. Example in multi-variable scenario A + B + C.',
      formatter: (value, _args, variable, fieldPath) => {
        // A field path picks a field of the value itself, so there is no separate text for it
        if (!fieldPath) {
          const text = variable.getValue('text');

          if (text !== undefined && text !== null) {
            return isArray(text) ? text.join(' + ') : String(text);
          }
        }

        return isArray(value) ? value.join(' + ') : String(value);
      },
    },
    {
      id: VariableFormatID.QueryParam,
      name: 'Query parameter',
      description:
        'Format variables as URL parameters. Example in multi-variable scenario A + B + C => var-foo=A&var-foo=B&var-foo=C.',
      // TODO: let a variable with its own url sync (like ad hoc filters) render its url state instead
      formatter: (value, _args, variable) => {
        if (Array.isArray(value)) {
          return value
            .map((v) => formatQueryParameter(variable.name, v))
            .join('&');
        }

        return formatQueryParameter(variable.name, value);
      },
    },
    {
      id: 'customqueryparam',
      name: 'Custom query parameter',
      description:
        'Format variables as URL parameters with custom name and value prefix. Example in multi-variable scenario A + B + C => p-foo=x-A&p-foo=x-B&p-foo=x-C.',
      formatter: (value, args, variable) => {
        const name = encodeURIComponentStrict(args[0] || variable.name);
        const valuePrefix = encodeURIComponentStrict(args[1] || '');

        if (Array.isArray(value)) {
          return value
            .map((v) =>
              customFormatQueryParameter(name, String(v), valuePrefix),
            )
            .join('&');
        }

        return customFormatQueryParameter(name, String(value), valuePrefix);
      },
    },
    {
      id: VariableFormatID.UriEncode,
      name: 'Percent encode as URI',
      description: t(
        'grafana-scenes.variables.format-registry.formats.description.useful-escaping-values-taking-syntax-characters',
        'Useful for URL escaping values, taking into URI syntax characters',
      ),
      formatter: (value) => {
        if (isArray(value)) {
          return encodeURIStrict('{' + value.join(',') + '}');
        }

        return encodeURIStrict(String(value));
      },
    },
  ];

  return formats;
});

function luceneEscape(value: string) {
  if (isNaN(+value) === false) {
    return value;
  }

  return value.replace(
    // eslint-disable-next-line no-useless-escape
    /([\!\*\+\-\=<>\s\&\|\(\)\[\]\{\}\^\~\?\:\\/"])/g,
    '\\$1',
  );
}

/**
 * encode string according to RFC 3986; in contrast to encodeURIComponent()
 * also the sub-delims "!", "'", "(", ")" and "*" are encoded;
 * unicode handling uses UTF-8 as in ECMA-262.
 */
function encodeURIComponentStrict(str: string) {
  return replaceSpecialCharactersToASCII(encodeURIComponent(str));
}

const encodeURIStrict = (str: string): string =>
  replaceSpecialCharactersToASCII(encodeURI(String(str)));

const replaceSpecialCharactersToASCII = (value: string): string =>
  value.replace(/[!'()*]/g, (c) => {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });

function formatQueryParameter(
  name: string,
  value: VariableValueSingle,
): string {
  return `var-${name}=${encodeURIComponentStrict(String(value))}`;
}

function customFormatQueryParameter(
  name: string,
  value: string,
  valuePrefix = '',
): string {
  return `${name}=${valuePrefix}${encodeURIComponentStrict(value)}`;
}

export function isAllValue(value: FormatValue) {
  return (
    value === ALL_VARIABLE_VALUE ||
    (Array.isArray(value) && value[0] === ALL_VARIABLE_VALUE)
  );
}

const SQL_ESCAPE_MAP: Record<string, string> = {
  "'": "''",
  '"': '\\"',
};

function sqlStringFormatter(value: FormatValue) {
  // escape single quotes by pairing them
  const regExp = new RegExp(`'|"`, 'g');

  if (isArray(value)) {
    return map(
      value,
      (v: string) =>
        `'${replace(v, regExp, (match) => SQL_ESCAPE_MAP[match] ?? '')}'`,
    ).join(',');
  }

  const strVal = typeof value === 'string' ? value : String(value);
  return `'${replace(strVal, regExp, (match) => SQL_ESCAPE_MAP[match] ?? '')}'`;
}
