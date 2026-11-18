import React from 'react';
import type { ScopedVars } from '@grafana/data';
import { VariableFormatID } from '@grafana/schema';

import { VARIABLE_REGEX } from '../constants';
import {
  VariableContext,
  type VariableValue,
  type InterpolationFormatParameter,
  type VariableContextState,
} from '../types';
import { formatRegistry, type FormatVariable } from './formatRegistry';

export function useInterpolator(
  input: string,
  _scopedVars?: ScopedVars,
  _format?: InterpolationFormatParameter,
): [string, boolean] {
  const context = React.useContext(VariableContext);

  if (!context) {
    return [input, false];
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return React.useMemo(() => {
    return interpolate(input, context);
  }, [input, context]);
}

function interpolate(
  target: string,
  context: VariableContextState<unknown>,
  scopedVars?: ScopedVars,
  _format?: InterpolationFormatParameter,
): [string, boolean] {
  VARIABLE_REGEX.lastIndex = 0;

  let loading = false;

  const result = target.replace(
    VARIABLE_REGEX,
    (match, var1, var2, _fmt2, var3, fieldPath, _fmt3) => {
      const variableName = var1 || var2 || var3;
      //const fmt = fmt2 || fmt3 || format;
      const variable = lookupVariable(variableName, match, scopedVars, context);

      if (!variable) {
        return match;
      }

      if (variable.loading) {
        loading = true;
      }

      return String(variable.getValue(fieldPath) || '');
    },
  );

  return [result, loading];
}

function lookupVariable(
  name: string,
  _match: string,
  _scopedVars: ScopedVars | undefined,
  context: VariableContextState<unknown>,
): VariableContextState<unknown> | undefined {
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
  value: VariableValue | null | undefined,
  formatNameOrFn?: InterpolationFormatParameter,
  fieldPath?: string,
): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Variable can return a custom value that handles formatting
  // This is useful for customAllValue and macros that return values that are already formatted or need special formatting
  // if (isCustomVariableValue(value)) {
  //   return sceneInterpolator(context, value.formatter(formatNameOrFn));
  // }

  // if it's an object transform value to string
  // if (!Array.isArray(value) && typeof value === 'object') {
  //   value = `${value}`;
  // }

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
