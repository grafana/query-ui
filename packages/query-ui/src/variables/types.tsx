import { createContext } from 'react';
import type { Location } from 'react-router-dom';
import type { ScopedVars, TimeRange, VariableType } from '@grafana/data';
import type { TimeZone } from '@grafana/schema';

export type VariableValue = {
  label?: string;
  value?: string | number | boolean;
  properties?: Record<string, unknown>;
};

/**
 * What a variable that takes values can hold: one value, or a list of them for
 * a multi-value variable.
 */
export type VariableValueOrValues = VariableValue | VariableValue[];

export interface VariableValueOption {
  label: string;
  value: string | number | boolean;
  properties?: Record<string, unknown>;
  group?: string;
}

export interface VariableContextState<T = unknown> {
  name: string;
  value: T;
  options?: VariableValueOption[];
  loading?: boolean;
  error?: Error | null;
  parent?: VariableContextState<unknown> | undefined;
  /**
   * Fetches the options on demand, filtered by what the user typed. A variable
   * sets this when its options are too costly to fetch up front, and pickers use
   * it over `options` when it is there.
   */
  loadOptions?(searchFilter: string): Promise<VariableValueOption[]>;
  getValue(fieldPath?: string, returnLabel?: boolean): unknown;
  onOptionsChange(options: VariableValueOption[]): void;
  onChange(value: T): void;
  onSetLoading(loading: boolean): void;
  onSetError(error: Error | null): void;
}

export const VariableContext = createContext<
  VariableContextState<unknown> | undefined
>(undefined);

/**
 * Used in CustomFormatterFn
 */
export interface CustomFormatterVariable {
  name: string;
  type: VariableType;
  multi?: boolean;
  includeAll?: boolean;
}

export type VariableCustomFormatterFn = (
  value: unknown,
  legacyVariableModel: Partial<CustomFormatterVariable>,
  legacyDefaultFormatter?: VariableCustomFormatterFn,
) => string;

export type InterpolationFormatParameter =
  string | VariableCustomFormatterFn | undefined;

/**
 * A value that formats itself instead of going through the format registry.
 * Macros use it for values that are already formatted, like
 * `$__url_time_range`, or that read the format as their own options, like
 * `${__url.params:exclude:from}`.
 */
export interface CustomVariableValue {
  /**
   * Receives the format named in the expression, or the default format. What
   * it returns goes into the result as is, without being interpolated again.
   */
  formatter(formatNameOrFn?: InterpolationFormatParameter): string;
}

export function isCustomVariableValue(
  value: unknown,
): value is CustomVariableValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'formatter' in value &&
    typeof value.formatter === 'function'
  );
}

export interface QueryUIScopedVars extends ScopedVars {
  __timeRange?: { value: TimeRange };
  /** The time zone of `__timeRange`, used by `$__timezone` and the `text` format of `$__from`/`$__to`. */
  __timeZone?: { value: TimeZone };
  /** The router location, without the Grafana sub path, used by `${__url}`. */
  __location?: { value: Location };
}
