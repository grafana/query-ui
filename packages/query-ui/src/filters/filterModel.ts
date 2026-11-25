import type { AdHocVariableFilter } from '@grafana/data';

export interface AdHocFilterWithLabels<
  M extends Record<string, unknown> = Record<string, unknown>,
> extends AdHocVariableFilter {
  keyLabel?: string;
  valueLabels?: string[];
  meta?: M;
}

export interface OperatorDefinition {
  value: string;
  description: string;
  /** The operator takes several values, stored in `values`. */
  isMulti?: boolean;
  /** The value is a regular expression. */
  isRegex?: boolean;
}

export const OPERATORS: OperatorDefinition[] = [
  { value: '=', description: 'Equals' },
  { value: '!=', description: 'Not equal' },
  {
    value: '=|',
    description: 'One of. Use to filter on multiple values.',
    isMulti: true,
  },
  {
    value: '!=|',
    description: 'Not one of. Use to exclude multiple values.',
    isMulti: true,
  },
  { value: '=~', description: 'Matches regex', isRegex: true },
  { value: '!~', description: 'Does not match regex', isRegex: true },
];

export function isMultiValueOperator(operator: string | undefined): boolean {
  return OPERATORS.some((op) => op.value === operator && op.isMulti);
}
