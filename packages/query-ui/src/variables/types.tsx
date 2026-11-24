import { createContext } from 'react';
import type { ScopedVars, TimeRange, VariableType } from '@grafana/data';

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

export interface QueryUIScopedVars extends ScopedVars {
  __timeRange?: { value: TimeRange };
  __location?: { value: Location };
}
