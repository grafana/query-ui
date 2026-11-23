import { QueryClientContext } from '@tanstack/react-query';
import { cloneDeep, merge } from 'lodash';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type AbsoluteTimeRange,
  applyFieldOverrides,
  dateTime,
  type FieldConfigSource,
  getDefaultTimeRange,
  getPanelOptionsWithDefaults,
  type InterpolateFunction,
  LoadingState,
  type PanelPlugin,
  renderMarkdown,
} from '@grafana/data';
import { config, getPluginImportUtils } from '@grafana/runtime';

import { TimeRangeContext } from '../../time/TimeRangeContext';
import {
  interpolate,
  useInterpolator,
} from '../../variables/interpolation/useInterpolator';
import {
  type InterpolationFormatParameter,
  type QueryUIScopedVars,
  VariableContext,
} from '../../variables/types';
import type { VizConfig } from './PanelBuilders/types';
import type { VizPanelProps } from './VizPanel';

/**
 * Field config and options changed by the panel itself, for example by
 * toggling series in the legend. They belong to one vizConfig instance:
 * a new vizConfig prop discards them.
 */
interface TransientConfig {
  vizConfig: VizConfig;
  fieldConfig?: FieldConfigSource;
  options?: PanelOptions;
}

type PanelOptions = Record<string, unknown>;

export function useVizPanel(props: VizPanelProps) {
  const { data: rawData, vizConfig } = props;
  const plugin = usePanelPlugin(vizConfig.pluginId);
  const [title] = useInterpolator(props.title ?? '');
  const [description] = useInterpolator(props.description ?? '');

  // PanelChrome calls this only when the description tooltip opens, so the
  // markdown is not rendered for panels whose description nobody reads.
  const getDescription = useCallback(
    () => renderMarkdown(description),
    [description],
  );

  // Passed to the panel plugin, which interpolates its own strings with it,
  // for example in data links or text panel content.
  const variableContext = useContext(VariableContext);

  const replaceVariables: InterpolateFunction = useCallback(
    (value, scopedVars, format) => {
      const [result] = interpolate(
        value,
        variableContext,
        scopedVars as QueryUIScopedVars | undefined,
        format as InterpolationFormatParameter,
      );
      return result;
    },
    [variableContext],
  );

  const [transient, setTransient] = useState<TransientConfig>(() => ({
    vizConfig,
  }));

  // Comparing during render instead of resetting in an effect means the first
  // render with a new vizConfig already uses it, with no stale frame between.
  const isTransientCurrent = transient.vizConfig === vizConfig;
  const currentFieldConfig =
    (isTransientCurrent && transient.fieldConfig) || vizConfig.fieldConfig;
  // VizConfig types its options as a partial of the plugin's option type,
  // which carries no index signature.
  const currentOptions =
    (isTransientCurrent && transient.options) ||
    (vizConfig.options as PanelOptions);

  /**
   * Merges the update into the current field config, or replaces it when
   * `replace` is true. The change lasts until the vizConfig prop changes.
   */
  const onFieldConfigChange = useCallback(
    (update: FieldConfigSource, replace?: boolean) => {
      setTransient((prev) => {
        const base = prev.vizConfig === vizConfig ? prev : { vizConfig };
        const current = base.fieldConfig ?? vizConfig.fieldConfig;
        const fieldConfig = replace
          ? update
          : merge(cloneDeep(current), update);

        return { ...base, fieldConfig };
      });
    },
    [vizConfig],
  );

  /**
   * Merges the update into the current options, or replaces them when
   * `replace` is true. The change lasts until the vizConfig prop changes.
   */
  const onOptionsChange = useCallback(
    (update: PanelOptions, replace?: boolean) => {
      setTransient((prev) => {
        const base = prev.vizConfig === vizConfig ? prev : { vizConfig };
        const current = base.options ?? (vizConfig.options as PanelOptions);
        const options = replace ? update : merge(cloneDeep(current), update);

        return { ...base, options };
      });
    },
    [vizConfig],
  );

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
      return { fieldConfig: currentFieldConfig, options: currentOptions };
    }

    return getPanelOptionsWithDefaults({
      plugin,
      currentOptions,
      currentFieldConfig,
      isAfterPluginChange: false,
    });
  }, [plugin, currentOptions, currentFieldConfig]);

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
      replaceVariables,
      theme: config.theme2,
      timeZone: timeZone,
    });
  }, [rawFrames, withDefaults.fieldConfig, timeZone, plugin, replaceVariables]);

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
    title,
    getDescription:
      props.description !== undefined ? getDescription : undefined,
    onCancelQuery,
    plugin,
    isLoading,
    fieldConfig: withDefaults.fieldConfig,
    panelOptions: withDefaults.options,
    panelData: panelDataApplied,
    onChangeTimeRange,
    onFieldConfigChange,
    onOptionsChange,
    replaceVariables,
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
