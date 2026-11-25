import React, { useContext, useEffect } from 'react';
import { stringToJsRegex } from '@grafana/data';
import {
  getDataSourceInstanceList,
  getDefaultDataSourceInstanceListItem,
} from '@grafana/plugin-compat/datasources';
import type { DataSourceRef } from '@grafana/schema';

import { useInterpolator } from './interpolation/useInterpolator';
import {
  VariableContext,
  type VariableValue,
  type VariableContextState,
  type VariableValueOption,
} from './types';
import { useVariableContextState } from './useVariableContextState';

export const DATA_SOURCE_DEFAULT_OPTION_VALUE = 'default';
export const NO_DATA_SOURCES_FOUND_ERROR = 'No data sources found';

export interface DataSourceVariableProps {
  name: string;
  /**
   * Initial value: a data source uid or ref, or `default` when `defaultOptionEnabled` is set.
   * Kept when it matches one of the loaded options, otherwise the first option is selected.
   * A value remembered from an earlier mount of a variable with the same `name` wins over this one.
   * Left out, the variable starts out loading until the options select one.
   */
  value?: string | DataSourceRef;
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
  skipUrlSync,
  children,
}: DataSourceVariableProps) {
  const parentContext = useContext(VariableContext);
  const uid = typeof value === 'string' ? value : value?.uid;

  const context = useVariableContextState({
    name,
    value: { value: uid, label: uid },
    parent: parentContext,
    skipUrlSync,
    rememberValue: true,
  });

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
  const { onOptionsChange, onSetLoading, onSetError } = context;

  useEffect(() => {
    // Handing the options over checks the value against them and ends loading
    if (!pluginId) {
      onOptionsChange([]);
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
        onSetError(
          options.length === 0 ? new Error(NO_DATA_SOURCES_FOUND_ERROR) : null,
        );
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

function matches(name: string, regex?: RegExp) {
  if (!regex) {
    return true;
  }

  // Reset state in case the regex has the global flag
  regex.lastIndex = 0;
  return regex.test(name);
}
