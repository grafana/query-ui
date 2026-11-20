import { createContext } from 'react';
import type { VariableType } from '@grafana/data';

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
  /** Whether the value is a list, so formatters join it as one. */
  isMulti?: boolean;
  options?: VariableValueOption[];
  loading?: boolean;
  error?: Error | null;
  parent?: VariableContextState<unknown> | undefined;
  getValue(fieldPath?: string): unknown;
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
