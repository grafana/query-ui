import React, { useContext, useEffect, useMemo, useState } from 'react';

import { useInterpolator } from '../interpolation/useInterpolator';
import { VariableContext, type VariableValueOrValues } from '../types';
import { hasValue, useVariableContextState } from '../useVariableContextState';
import {
  useVariableOptionsLoader,
  type VariableQueryDefinition,
} from './useVariableOptionsQuery';

/**
 * The data source uid, a string query and the regex can reference variables
 * defined above this one.
 */
export interface QueryVariableProps extends VariableQueryDefinition {
  name: string;
  /**
   * Initial value. Pass an array, even an empty one, to make this a
   * multi-value variable. A value from the URL, or one remembered from an
   * earlier mount of a variable with the same `name`, wins over this one.
   */
  value?: VariableValueOrValues;
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
 * it is one of the options, otherwise the first option is selected. A
 * multi-value variable keeps the values that are options, and gets the first
 * option when none are.
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
  const initialValue = value ?? {};

  const context = useVariableContextState<VariableValueOrValues>({
    name,
    value: initialValue,
    loading: !hasValue(initialValue),
    parent: parentContext,
    skipUrlSync,
    rememberValue: true,
  });

  const currentValue = context.value;
  const { onOptionsChange, onSetLoading, onSetError } = context;

  // Interpolated against the parent context, so they can reference variables defined above this one
  const [uid, uidLoading] = useInterpolator(datasource.uid ?? '');
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

  // Handing the options over checks the value against them and ends loading
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
