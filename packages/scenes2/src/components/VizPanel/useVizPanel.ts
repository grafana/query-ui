import { QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type AbsoluteTimeRange,
  applyFieldOverrides,
  dateTime,
  getDefaultTimeRange,
  getPanelOptionsWithDefaults,
  LoadingState,
  type PanelPlugin,
} from '@grafana/data';
import { config, getPluginImportUtils } from '@grafana/runtime';

import { TimeRangeContext } from '../../time/TimeRangeContext';
import type { VizPanelProps } from './VizPanel';

export function useVizPanel(props: VizPanelProps) {
  const { data: rawData, vizConfig } = props;
  const plugin = usePanelPlugin(vizConfig.pluginId);

  // Optional: a panel rendered outside a provider has no range to change.
  const onChangeTimeRangeFromContext =
    useContext(TimeRangeContext)?.onChangeTimeRange;

  const onChangeTimeRange = useCallback(
    (range: AbsoluteTimeRange) => {
      const from = dateTime(range.from);
      const to = dateTime(range.to);
      onChangeTimeRangeFromContext?.({ from, to, raw: { from, to } });
    },
    [onChangeTimeRangeFromContext],
  );

  // Apply plugin option and field config defaults
  const withDefaults = useMemo(() => {
    if (!plugin) {
      return { fieldConfig: vizConfig.fieldConfig, options: vizConfig.options };
    }

    return getPanelOptionsWithDefaults({
      plugin,
      // VizConfig types its options as a partial of the plugin's option type,
      // which carries no index signature.
      currentOptions: vizConfig.options as Record<string, unknown>,
      currentFieldConfig: vizConfig.fieldConfig,
      isAfterPluginChange: false,
    });
  }, [plugin, vizConfig.options, vizConfig.fieldConfig]);

  const rawFrames = rawData?.series;
  const timeZone = rawData?.request?.timezone;

  // Apply field overrides to data frames
  const appliedFrames = useMemo(() => {
    if (!plugin) {
      return rawFrames ?? [];
    }

    const fieldConfigRegistry = plugin.fieldConfigRegistry;
    return applyFieldOverrides({
      data: rawFrames,
      fieldConfig: withDefaults.fieldConfig,
      fieldConfigRegistry,
      replaceVariables: (value: string) => value,
      theme: config.theme2,
      timeZone: timeZone,
    });
  }, [rawFrames, withDefaults.fieldConfig, timeZone, plugin]);

  const panelDataApplied = useMemo(() => {
    if (!rawData) {
      return {
        state: LoadingState.Loading,
        series: [],
        timeRange: getDefaultTimeRange(),
        timeZone: 'browser',
      };
    }

    return { ...rawData, series: appliedFrames };
  }, [rawData, appliedFrames]);

  // Show the loading state while the plugin is importing or the query is
  // running. Missing data counts as running, since panelDataApplied falls
  // back to LoadingState.Loading for it.
  const isLoading =
    plugin === null || panelDataApplied.state === LoadingState.Loading;

  // useDataQuery sets the request id to the query's hash, which finds the query
  // in the cache. Data from anywhere else has no matching query, so the panel
  // gets no cancel button. Optional: a panel can render without a QueryClient.
  const queryClient = useContext(QueryClientContext);
  const requestId = rawData?.request?.requestId;

  const onCancelQuery = useCallback(() => {
    void queryClient?.cancelQueries({
      predicate: (query) => query.queryHash === requestId,
    });
  }, [queryClient, requestId]);

  return {
    onCancelQuery,
    plugin,
    isLoading,
    fieldConfig: withDefaults.fieldConfig,
    panelOptions: withDefaults.options,
    panelData: panelDataApplied,
    onChangeTimeRange,
  };
}

function usePanelPlugin(pluginId: string) {
  // A plugin that is already in the cache resolves synchronously, so the first
  // render can show the panel instead of going through a loading state.
  const [plugin, setPlugin] = useState<PanelPlugin | null>(
    () => getPluginImportUtils().getPanelPluginFromCache(pluginId) ?? null,
  );

  useEffect(() => {
    const pluginImportUtils = getPluginImportUtils();
    const cached = pluginImportUtils.getPanelPluginFromCache(pluginId);

    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlugin(cached);
      return;
    }

    let canceled = false;
    setPlugin(null);

    pluginImportUtils.importPanelPlugin(pluginId).then((loaded) => {
      if (!canceled) {
        setPlugin(loaded);
      }
    });

    return () => {
      canceled = true;
    };
  }, [pluginId]);

  return plugin;
}
