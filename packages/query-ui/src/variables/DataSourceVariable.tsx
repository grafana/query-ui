import React, { useContext, useEffect, useRef, useState } from 'react';
import { stringToJsRegex } from '@grafana/data';
import {
  getDataSourceInstanceList,
  getDefaultDataSourceInstanceListItem,
} from '@grafana/plugin-compat/datasources';

import { useCache } from '../caching/CacheContext';
import { useVariableContextState } from './DefineVariable';
import { useInterpolator } from './interpolation/useInterpolator';
import {
  VariableContext,
  type VariableContextState,
  type VariableValue,
  type VariableValueOption,
} from './types';

export const DATA_SOURCE_DEFAULT_OPTION_VALUE = 'default';
export const NO_DATA_SOURCES_FOUND_ERROR = 'No data sources found';

export interface DataSourceVariableProps {
  name: string;
  /**
   * Initial value: a data source uid, or `default` when `defaultOptionEnabled` is set.
   * Kept when it matches one of the loaded options, otherwise the first option is selected.
   * A value remembered from an earlier mount of a variable with the same `name` wins over this one.
   */
  value?: string;
  /**
   * Include all data source instances with this plugin id
   */
  pluginId: string;
  /**
   * Filter data source instances based on name. Can reference other variables.
   */
  regex?: string;
  /**
   * Adds a `default` option right after the default data source.
   * For backwards compatibility with old dashboards, will likely be removed.
   */
  defaultOptionEnabled?: boolean;
  /**
   * If it should start in a loading state or not
   */
  loading?: boolean;
  /**
   * Keeps the selection out of the URL. By default it is synced to the
   * `var-<name>` query parameter, and a value there wins over `value` and over
   * one remembered from an earlier mount.
   */
  skipUrlSync?: boolean;
  children: React.ReactNode;
}

export function DataSourceVariable({
  name,
  value,
  pluginId,
  regex = '',
  defaultOptionEnabled,
  loading,
  skipUrlSync,
  children,
}: DataSourceVariableProps) {
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
    loading: loading,
    parent: parentContext,
    skipUrlSync,
  });

  // Remember every selection under the variable name, whether it came from the options
  // resolving or from the user, so a remount picks up where this one left off. The closest
  // cache from `CacheContext` holds it; give a subtree its own `CacheProvider` to scope it.
  const currentValue = context.value;
  useEffect(() => {
    // Nothing selected yet, or no options to select from
    if (currentValue.value === undefined || currentValue.value === '') {
      return;
    }

    cache.set<VariableValue>(name, currentValue);
  }, [cache, name, currentValue]);

  // Interpolated against the parent context, so the regex can reference variables defined above this one
  const [interpolatedRegex, regexLoading] = useInterpolator(regex);

  useDataSourceOptions(context, {
    pluginId,
    regex: interpolatedRegex,
    regexLoading,
    defaultOptionEnabled,
  });

  return (
    <VariableContext.Provider value={context}>
      {children}
    </VariableContext.Provider>
  );
}

interface DataSourceOptionsArgs {
  pluginId: string;
  regex: string;
  regexLoading: boolean;
  defaultOptionEnabled?: boolean;
}

function useDataSourceOptions(
  context: VariableContextState<VariableValue>,
  {
    pluginId,
    regex,
    regexLoading,
    defaultOptionEnabled,
  }: DataSourceOptionsArgs,
) {
  const { onChange, onOptionsChange, onSetLoading, onSetError } = context;

  // Read the latest value when options resolve without re-running the effect on every value change
  // (declared before the loading effect so it runs first)
  const valueRef = useRef(context.value);
  useEffect(() => {
    valueRef.current = context.value;
  }, [context.value]);

  useEffect(() => {
    if (!pluginId) {
      onOptionsChange([]);
      onSetLoading(false);
      return;
    }

    // Wait for the variables the regex depends on
    if (regexLoading) {
      onSetLoading(true);
      return;
    }

    let cancelled = false;
    onSetLoading(true);

    getDataSourceOptions({ pluginId, regex, defaultOptionEnabled })
      .then((options) => {
        if (cancelled) {
          return;
        }

        onOptionsChange(options);
        onChange(validateValue(valueRef.current, options));
        onSetError(
          options.length === 0 ? new Error(NO_DATA_SOURCES_FOUND_ERROR) : null,
        );
        onSetLoading(false);
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
    pluginId,
    regex,
    regexLoading,
    defaultOptionEnabled,
    onChange,
    onOptionsChange,
    onSetLoading,
    onSetError,
  ]);
}

export async function getDataSourceOptions({
  pluginId,
  regex,
  defaultOptionEnabled,
}: {
  pluginId: string;
  regex?: string;
  defaultOptionEnabled?: boolean;
}): Promise<VariableValueOption[]> {
  if (!pluginId) {
    return [];
  }

  const nameRegex = regex ? stringToJsRegex(regex) : undefined;

  const dataSources = await getDataSourceInstanceList({
    metrics: true,
    variables: false,
    pluginId,
  });

  const defaultDataSource = defaultOptionEnabled
    ? await getDefaultDataSourceInstanceListItem(dataSources)
    : undefined;

  const options: VariableValueOption[] = [];

  for (const source of dataSources) {
    if (matches(source.name, nameRegex)) {
      options.push({ label: source.name, value: source.uid });
    }

    if (
      defaultDataSource?.uid === source.uid &&
      matches(DATA_SOURCE_DEFAULT_OPTION_VALUE, nameRegex)
    ) {
      options.push({
        label: DATA_SOURCE_DEFAULT_OPTION_VALUE,
        value: DATA_SOURCE_DEFAULT_OPTION_VALUE,
      });
    }
  }

  return options;
}

/**
 * Keeps the current value when it is one of the options, otherwise picks the first option.
 */
function validateValue(
  current: VariableValue,
  options: VariableValueOption[],
): VariableValue {
  const match = options.find((option) => option.value === current.value);
  const selected = match ?? options[0];

  if (!selected) {
    return { value: '', label: '' };
  }

  return { value: selected.value, label: selected.label };
}

function matches(name: string, regex?: RegExp) {
  if (!regex) {
    return true;
  }

  // Reset state in case the regex has the global flag
  regex.lastIndex = 0;
  return regex.test(name);
}
