import React from 'react';

import { VARIABLE_REGEX } from '../constants';
import { macrosIndex } from '../macros';
import {
  isCustomVariableValue,
  type QueryUIScopedVars,
  VariableContext,
  type InterpolationFormatParameter,
  type VariableContextState,
} from '../types';
import { formatValue, type FormatVariable } from './formatRegistry';

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

        return formatVariable(variable, fieldPath, fmt);
      }

      const macroHandler = macrosIndex.get(variableName);

      if (macroHandler) {
        const macro = macroHandler(variableName, match, scopedVars);
        return formatVariable(macro, fieldPath, fmt);
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

function formatVariable(
  variable: FormatVariable,
  fieldPath: string | undefined,
  fmt: InterpolationFormatParameter,
): string {
  const value = variable.getValue(fieldPath);

  // A custom value formats itself, and what it returns is final. It is not
  // interpolated again: it can hold text from the URL, and a crafted link could
  // then expand variables or make a macro repeat itself without end.
  if (isCustomVariableValue(value)) {
    return value.formatter(fmt);
  }

  return formatValue(variable, value, fmt, fieldPath);
}
