import React from 'react';
import { VariableFormatID } from '@grafana/schema';

import { VARIABLE_REGEX } from '../constants';
import { macrosIndex } from '../macros';
import {
  isCustomVariableValue,
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

export function interpolate(
  target: string,
  context: VariableContextState<unknown> | undefined,
  scopedVars?: QueryUIScopedVars,
  format?: InterpolationFormatParameter,
): [string, boolean] {
  VARIABLE_REGEX.lastIndex = 0;

  let loading = false;

  // A custom value formats itself. What it returns is already formatted but can
  // hold variable expressions of its own (like a custom all value), so it is
  // interpolated again without a default format.
  const formatOrInterpolate = (
    variable: FormatVariable,
    fieldPath: string | undefined,
    fmt: InterpolationFormatParameter,
  ): string => {
    const value = variable.getValue(fieldPath);

    if (isCustomVariableValue(value)) {
      const [nested, nestedLoading] = interpolate(
        value.formatter(fmt),
        context,
        scopedVars,
      );
      loading = loading || nestedLoading;
      return nested;
    }

    return formatValue(variable, value, fmt, fieldPath);
  };

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

        return formatOrInterpolate(variable, fieldPath, fmt);
      }

      const macroHandler = macrosIndex.get(variableName);

      if (macroHandler) {
        const macro = macroHandler(variableName, match, scopedVars);
        return formatOrInterpolate(macro, fieldPath, fmt);
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
