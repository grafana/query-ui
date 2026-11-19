import React from 'react';
import { VariableFormatID } from '@grafana/schema';

import { VARIABLE_REGEX } from '../constants';
import { macrosIndex } from '../macros';
import {
  type QueryUIScopedVars,
  VariableContext,
  type InterpolationFormatParameter,
  type VariableContextState,
} from '../types';
import {
  formatRegistry,
  type FormatValue,
  type FormatVariable,
} from './formatRegistry';

/**
 * Replaces the variable expressions in `input` (`$var`, `[[var]]`, `${var}`,
 * `${var.field}` and `${var:format}`) with the values of the closest variables.
 * `format` applies to the expressions that don't name a format of their own.
 *
 * Returns the interpolated string, and whether any of the variables it used is
 * still loading.
 */
export function useInterpolator(
  input: string,
  scopedVars?: QueryUIScopedVars,
  format?: InterpolationFormatParameter,
): [string, boolean] {
  const context = React.useContext(VariableContext);

  return React.useMemo(() => {
    return interpolate(input, context, scopedVars, format);
  }, [input, context, scopedVars, format]);
}

function interpolate(
  target: string,
  context: VariableContextState<unknown> | undefined,
  scopedVars?: QueryUIScopedVars,
  format?: InterpolationFormatParameter,
): [string, boolean] {
  VARIABLE_REGEX.lastIndex = 0;

  let loading = false;

  const result = target.replace(
    VARIABLE_REGEX,
    (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
      const variableName = var1 || var2 || var3;
      const fmt = fmt2 || fmt3 || format;
      const variable = lookupVariable(variableName, context);

      if (variable) {
        if (variable.loading) {
          loading = true;
        }

        return formatValue(
          variable,
          variable.getValue(fieldPath),
          fmt,
          fieldPath,
        );
      }

      if (macrosIndex.get(variableName)) {
        const macro = macrosIndex.get(variableName)!(
          variableName,
          match,
          scopedVars,
        );
        return formatValue(macro, macro.getValue(fieldPath), fmt, fieldPath);
      }

      return match;
    },
  );

  return [result, loading];
}

function lookupVariable(
  name: string,
  context: VariableContextState<unknown> | undefined,
): VariableContextState | undefined {
  let current: VariableContextState<unknown> | undefined = context;

  while (current) {
    if (current.name === name) {
      return current;
    }
    current = current.parent;
  }

  return current;
}

function formatValue(
  variable: FormatVariable,
  rawValue: unknown,
  formatNameOrFn?: InterpolationFormatParameter,
  fieldPath?: string,
): string {
  if (rawValue === null || rawValue === undefined) {
    return '';
  }

  // TODO: let a variable return a custom value that does its own formatting,
  // like the old scenes CustomVariableValue (used for customAllValue and macros)

  // Formatters only handle primitives and arrays, so an object becomes a string
  const value: FormatValue =
    !Array.isArray(rawValue) && typeof rawValue === 'object'
      ? `${rawValue}`
      : (rawValue as FormatValue);

  if (typeof formatNameOrFn === 'function') {
    return formatNameOrFn(value, {
      name: variable.name,
      type: variable.type,
      multi: variable.isMulti,
      includeAll: variable.includeAll,
    });
  }

  let args: string[] = [];

  if (!formatNameOrFn) {
    formatNameOrFn = VariableFormatID.Glob;
  } else {
    // some formats have arguments that come after ':' character
    args = formatNameOrFn.split(':');
    if (args.length > 1) {
      formatNameOrFn = args[0];
      args = args.slice(1);
    } else {
      args = [];
    }
  }

  let formatter = formatRegistry.getIfExists(formatNameOrFn);

  if (!formatter) {
    console.error(
      `Variable format ${formatNameOrFn} not found. Using glob format as fallback.`,
    );
    formatter = formatRegistry.get(VariableFormatID.Glob);
  }

  return formatter.formatter(value, args, variable, fieldPath);
}
