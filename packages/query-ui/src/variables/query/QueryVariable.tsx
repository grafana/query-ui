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
 *
 * A value the variable starts with, like one from the URL, is not checked
 * until what it depends on changes, so it is kept even when it is not one of
 * the options.
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
  // starts with, like one from the URL, is trusted until what it depends on
  // changes. A dependency that is still loading only changes it if it ends up
  // with a different value, so a value whose parent also comes from the URL is
  // kept even when it is not one of the options.
  const [checkedKey, setCheckedKey] = useState(() =>
    hasValue(currentValue) ? dependenciesKey : undefined,
  );
  const loadOptions = useVariableOptionsLoader(queryProps);

  // The value can't be trusted from the render in which what it depends on
  // changes. Deriving that here, rather than setting it from the effect below,
  // keeps the variables and queries below from running a commit with the new
  // parent value, the old value of this one, and no sign that it is stale.
  const checking = dependenciesLoading || checkedKey !== dependenciesKey;

  // Handing the options over checks the value against them
  useEffect(() => {
    // Wait for the variables the query depends on
    if (dependenciesLoading || checkedKey === dependenciesKey) {
      return;
    }

    let cancelled = false;

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
        // Failed, but checked: the value stays until the dependencies change
        setCheckedKey(dependenciesKey);
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

  const loading = context.loading || checking;
  const queryContext = useMemo(
    () => ({ ...context, loading, loadOptions }),
    [context, loading, loadOptions],
  );

  return (
    <VariableContext.Provider value={queryContext}>
      {children}
    </VariableContext.Provider>
  );
}
