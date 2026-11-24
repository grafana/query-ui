import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { VariableRegexApplyTo, VariableSort } from '@grafana/data';
import type { DataQuery } from '@grafana/schema';

import { useCache } from '../../caching/CacheContext';
import { useVariableContextState } from '../DefineVariable';
import { useInterpolator } from '../interpolation/useInterpolator';
import {
  VariableContext,
  type VariableValue,
  type VariableValueOption,
} from '../types';
import { useVariableOptionsLoader } from './useVariableOptionsQuery';
import type { StaticOptionsOrder } from './utils';

export interface QueryVariableProps {
  name: string;
  /**
   * Initial value. A value from the URL, or one remembered from an earlier
   * mount of a variable with the same `name`, wins over this one.
   */
  value?: string;
  /** Data source to run the query against. The uid can reference other variables. */
  datasource: { uid: string };
  /** The variable query. A string query can reference other variables. */
  query: string | DataQuery;
  /** Filters the query results. Can reference other variables. */
  regex?: string;
  /** What the regex is matched against. Defaults to `value`. */
  regexApplyTo?: VariableRegexApplyTo;
  sort?: VariableSort;
  /** Added to the options returned by the query. */
  staticOptions?: VariableValueOption[];
  /** Where static options go relative to the query results. Defaults to `before`. */
  staticOptionsOrder?: StaticOptionsOrder;
  /**
   * Keeps the selection out of the URL. By default it is synced to the
   * `var-<name>` query parameter.
   */
  skipUrlSync?: boolean;
  children: React.ReactNode;
}

/**
 * A variable whose options come from a data source query.
 *
 * Options load lazily: the query runs when a picker opens (through
 * `loadOptions`), with what the user types sent as `__searchFilter`. It also
 * runs to check the value: on mount when there is no value yet, and whenever
 * the interpolated data source, query or regex change. The value is kept when
 * it is one of the options, otherwise the first option is selected.
 */
export function QueryVariable({
  name,
  value,
  datasource,
  query,
  regex = '',
  regexApplyTo,
  sort,
  staticOptions,
  staticOptionsOrder,
  skipUrlSync,
  children,
}: QueryVariableProps) {
  const parentContext = useContext(VariableContext);
  const cache = useCache();

  // Read once: the state below only takes its initial value from this on mount
  const [cachedValue] = useState(() => cache.get<VariableValue>(name));
  const initialValue = cachedValue ?? {
    value: value ?? '',
    label: value ?? '',
  };

  const context = useVariableContextState({
    name,
    value: initialValue,
    loading: !hasValue(initialValue),
    parent: parentContext,
    skipUrlSync,
  });

  const currentValue = context.value;
  const { onChange, onOptionsChange, onSetLoading, onSetError } = context;

  // Remember the selection under the variable name, so a remount picks it up
  useEffect(() => {
    if (hasValue(currentValue)) {
      cache.set<VariableValue>(name, currentValue);
    }
  }, [cache, name, currentValue]);

  // Interpolated against the parent context, so they can reference variables defined above this one
  const [uid, uidLoading] = useInterpolator(datasource.uid);
  const [stringQuery, queryLoading] = useInterpolator(
    typeof query === 'string' ? query : '',
  );
  const [interpolatedRegex, regexLoading] = useInterpolator(regex);
  const dependenciesLoading = uidLoading || queryLoading || regexLoading;

  const datasourceRef = useMemo(() => ({ uid }), [uid]);
  const queryProps = {
    datasource: datasourceRef,
    query: typeof query === 'string' ? stringQuery : query,
    name,
    regex: interpolatedRegex,
    regexApplyTo,
    sort,
    staticOptions,
    staticOptionsOrder,
  };

  // What the options depend on. The value is checked against the options
  // whenever this changes, like when a variable the query references changes.
  const dependenciesKey = JSON.stringify([
    uid,
    queryProps.query,
    interpolatedRegex,
  ]);

  // The dependencies the value was last checked against. A value the variable
  // starts with is trusted, unless what it depends on is still loading.
  const [checkedKey, setCheckedKey] = useState(() =>
    hasValue(currentValue) && !dependenciesLoading
      ? dependenciesKey
      : undefined,
  );
  const loadOptions = useVariableOptionsLoader(queryProps);

  // Read the latest value when the options resolve, without re-running the check on every value change
  const valueRef = useRef(currentValue);
  useEffect(() => {
    valueRef.current = currentValue;
  }, [currentValue]);

  // Keep the value when it is one of the options, otherwise select the first option
  useEffect(() => {
    // Wait for the variables the query depends on
    if (dependenciesLoading) {
      onSetLoading(true);
      return;
    }

    if (checkedKey === dependenciesKey) {
      onSetLoading(false);
      return;
    }

    let cancelled = false;
    onSetLoading(true);

    loadOptions()
      .then((options) => {
        if (cancelled) {
          return;
        }

        onOptionsChange(options);
        const current = valueRef.current;
        const validated = validateValue(current, options);
        if (
          validated.value !== current.value ||
          validated.label !== current.label
        ) {
          onChange(validated);
        }
        onSetError(null);
        setCheckedKey(dependenciesKey);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }

        onSetError(err instanceof Error ? err : new Error(String(err)));
        onSetLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    checkedKey,
    dependenciesKey,
    dependenciesLoading,
    loadOptions,
    onChange,
    onOptionsChange,
    onSetError,
    onSetLoading,
  ]);

  const queryContext = useMemo(
    () => ({ ...context, loadOptions }),
    [context, loadOptions],
  );

  return (
    <VariableContext.Provider value={queryContext}>
      {children}
    </VariableContext.Provider>
  );
}

/**
 * Keeps the current value when it is one of the options, with the option's
 * label, otherwise picks the first option.
 */
function validateValue(
  current: VariableValue,
  options: VariableValueOption[],
): VariableValue {
  const match = options.find(
    (option) => String(option.value) === String(current.value),
  );
  const selected = match ?? options[0];

  if (!selected) {
    return { value: '', label: '' };
  }

  return { value: selected.value, label: selected.label };
}

function hasValue(value: VariableValue) {
  return value.value !== undefined && value.value !== '';
}
