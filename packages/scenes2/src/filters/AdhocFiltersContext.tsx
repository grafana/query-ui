import React, {
  createContext,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AdHocVariableFilter } from '@grafana/data';
import type { DataSourceRef } from '@grafana/schema';

import { useUrlState } from '../url/UrlStateContext';
import { deserializeFilters, serializeFilters } from './filtersUrl';

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

/** The filters as the query string carries them. */
interface AdhocFiltersUrlState {
  filters?: string;
}

/**
 * The query-string key the filters sync to, before the registry resolves
 * conflicts. A provider nested inside another one syncs to `filters2`.
 */
const urlKeys = ['filters'] as const;

/**
 * Holds the filters for the subtree below it.
 *
 * With a `UrlStateProvider` mounted above, the filters sync to the `filters`
 * query parameter: filters in the URL are what the provider mounts on (they
 * replace `initialFilters`), changing the filters adds a history entry, and
 * going back to an earlier entry restores its filters. Nested providers sync to
 * numbered keys, like `filters2`, so an inner set never overwrites the outer
 * one.
 *
 * The parameter holds each filter as `key|operator|value`, joined with `;`. A
 * label follows its key or value after a comma. Filters that are not complete,
 * and the `meta` of a filter, stay out of the URL.
 */
export function AdhocFiltersProvider({
  datasource,
  initialFilters,
  baseFilters,
  children,
}: AdhocFiltersProviderProps) {
  const [urlState, updateUrlState] = useUrlState<AdhocFiltersUrlState>(urlKeys);
  const urlValue = urlState.filters;

  // The filters the provider mounted with, which the URL falls back to when it
  // holds none. Read once, like the other initial values.
  const [defaultFilters] = useState<AdHocFilterWithLabels[]>(
    () => initialFilters ?? [],
  );

  // Filters in the URL win over the ones the provider was given.
  const [filters, setFilters] = useState<AdHocFilterWithLabels[]>(() =>
    urlValue === undefined ? defaultFilters : deserializeFilters(urlValue),
  );

  // The filters as the last change left them, for changes that land in the same
  // tick before the next render.
  const latest = useRef(filters);

  useLayoutEffect(() => {
    latest.current = filters;
  }, [filters]);

  // The url value for `next`. An empty list is written as an empty value when
  // the defaults have filters, so that clearing them survives a reload.
  const toUrlValue = useCallback(
    (next: AdHocFilterWithLabels[]): string | undefined => {
      const serialized = serializeFilters(next);

      return serialized === '' && defaultFilters.length === 0
        ? undefined
        : serialized;
    },
    [defaultFilters],
  );

  // Pick up a change to the URL made from outside, like the back button. It is
  // set while rendering, so that the new filters never show up a render late.
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue);

  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue);

    if (urlValue !== toUrlValue(filters)) {
      // A parameter that is gone puts the filters back to where they started
      setFilters(
        urlValue === undefined ? defaultFilters : deserializeFilters(urlValue),
      );
    }
  }

  const commit = useCallback(
    (next: AdHocFilterWithLabels[]) => {
      latest.current = next;
      setFilters(next);
      updateUrlState({ filters: toUrlValue(next) });
    },
    [toUrlValue, updateUrlState],
  );

  const onAddFilter = useCallback(
    (filter: AdHocFilterWithLabels) => {
      commit([...latest.current, filter]);
    },
    [commit],
  );

  const onUpdateFilter = useCallback(
    (filter: AdHocFilterWithLabels, update: Partial<AdHocFilterWithLabels>) => {
      commit(
        latest.current.map((f) => (f === filter ? { ...f, ...update } : f)),
      );
    },
    [commit],
  );

  const onRemoveFilter = useCallback(
    (filter: AdHocFilterWithLabels) => {
      commit(latest.current.filter((f) => f !== filter));
    },
    [commit],
  );

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
