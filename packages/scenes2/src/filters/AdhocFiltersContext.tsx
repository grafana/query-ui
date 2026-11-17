import React, { createContext, useCallback, useMemo, useState } from 'react';
import type { AdHocVariableFilter } from '@grafana/data';
import type { DataSourceRef } from '@grafana/schema';

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

export interface AdhocFiltersContextState {
  filters: AdHocFilterWithLabels[];
  /** Data source to query for tag keys/values, and to apply the filters against. */
  datasource?: DataSourceRef | null;
  /**
   * Filters that always apply when looking up tag keys and values. They are
   * appended to the user's filters in `getTagKeys` and `getTagValues` calls but
   * never shown, edited, or removed through the UI.
   */
  baseFilters?: AdHocFilterWithLabels[];
  onAddFilter(filter: AdHocFilterWithLabels): void;
  onUpdateFilter(
    filter: AdHocFilterWithLabels,
    update: Partial<AdHocFilterWithLabels>,
  ): void;
  onRemoveFilter(filter: AdHocFilterWithLabels): void;
}

export const AdhocFiltersContext =
  createContext<AdhocFiltersContextState | null>(null);

export interface AdhocFiltersProviderProps {
  datasource?: DataSourceRef | null;
  initialFilters?: AdHocFilterWithLabels[];
  baseFilters?: AdHocFilterWithLabels[];
  children: React.ReactNode;
}

export function AdhocFiltersProvider({
  datasource,
  initialFilters,
  baseFilters,
  children,
}: AdhocFiltersProviderProps) {
  const [filters, setFilters] = useState<AdHocFilterWithLabels[]>(
    initialFilters ?? [],
  );

  const onAddFilter = useCallback((filter: AdHocFilterWithLabels) => {
    setFilters((prev) => [...prev, filter]);
  }, []);

  const onUpdateFilter = useCallback(
    (filter: AdHocFilterWithLabels, update: Partial<AdHocFilterWithLabels>) => {
      setFilters((prev) =>
        prev.map((f) => (f === filter ? { ...f, ...update } : f)),
      );
    },
    [],
  );

  const onRemoveFilter = useCallback((filter: AdHocFilterWithLabels) => {
    setFilters((prev) => prev.filter((f) => f !== filter));
  }, []);

  const value = useMemo<AdhocFiltersContextState>(
    () => ({
      filters,
      datasource,
      baseFilters,
      onAddFilter,
      onUpdateFilter,
      onRemoveFilter,
    }),
    [
      filters,
      datasource,
      baseFilters,
      onAddFilter,
      onUpdateFilter,
      onRemoveFilter,
    ],
  );

  return (
    <AdhocFiltersContext.Provider value={value}>
      {children}
    </AdhocFiltersContext.Provider>
  );
}
