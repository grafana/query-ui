import { useCallback, useMemo, useState } from 'react';
import {
  CoreApp,
  type DataFrame,
  DashboardCursorSync,
  EventBusSrv,
  type FieldConfigSource,
} from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import type {
  PanelContext,
  SeriesVisibilityChangeMode,
  VizLegendOptions,
} from '@grafana/ui';

import { changeSeriesColorConfigFactory } from './colorSeriesConfigFactory';
import { seriesVisibilityConfigFactory } from './seriesVisibilityConfigFactory';

export interface PanelContextStateOptions {
  /** The field config the panel renders with, defaults applied. */
  fieldConfig: FieldConfigSource;
  /** The options the panel renders with, defaults applied. */
  options: Record<string, unknown>;
  /** The frames after field overrides, used to resolve series names. */
  frames: DataFrame[];
  onFieldConfigChange: (update: FieldConfigSource, replace?: boolean) => void;
  onOptionsChange: (update: Record<string, unknown>, replace?: boolean) => void;
}

// Grafana sets app events on boot. A host without them, such as a standalone
// app or a test, gets one shared bus so panels still see each other's events.
const fallbackEventBus = new EventBusSrv();

/**
 * Builds the PanelContext value for VizPanel. Legend interactions (series
 * color, series visibility, legend sort) change the panel's field config or
 * options through the callbacks from useVizPanel.
 */
export function usePanelContextState({
  fieldConfig,
  options,
  frames,
  onFieldConfigChange,
  onOptionsChange,
}: PanelContextStateOptions): PanelContext {
  const [instanceState, setInstanceState] = useState<unknown>();

  const onSeriesColorChange = useCallback(
    (label: string, color: string) => {
      onFieldConfigChange(
        changeSeriesColorConfigFactory(label, color, fieldConfig),
      );
    },
    [fieldConfig, onFieldConfigChange],
  );

  const onToggleSeriesVisibility = useCallback(
    (label: string | string[] | null, mode: SeriesVisibilityChangeMode) => {
      onFieldConfigChange(
        seriesVisibilityConfigFactory(label, mode, fieldConfig, frames),
        true,
      );
    },
    [fieldConfig, frames, onFieldConfigChange],
  );

  const onToggleLegendSort = useCallback(
    (sortKey: string) => {
      const legendOptions = options.legend as VizLegendOptions | undefined;

      // Panels without legend options have nothing to sort
      if (!legendOptions) {
        return;
      }

      let sortDesc = legendOptions.sortDesc;
      let sortBy = legendOptions.sortBy;
      if (sortKey !== sortBy) {
        sortDesc = undefined;
      }

      // A third click on an ascending column turns sorting off
      if (sortDesc === false) {
        sortBy = undefined;
        sortDesc = undefined;
      } else {
        sortDesc = !sortDesc;
        sortBy = sortKey;
      }

      onOptionsChange(
        { ...options, legend: { ...legendOptions, sortBy, sortDesc } },
        true,
      );
    },
    [options, onOptionsChange],
  );

  const eventBus = getAppEvents() ?? fallbackEventBus;

  return useMemo(
    () => ({
      eventsScope: '__global_',
      eventBus,
      app: CoreApp.Unknown,
      sync: () => DashboardCursorSync.Off,
      onSeriesColorChange,
      onToggleSeriesVisibility,
      onToggleLegendSort,
      instanceState,
      onInstanceStateChange: setInstanceState,
    }),
    [
      eventBus,
      onSeriesColorChange,
      onToggleSeriesVisibility,
      onToggleLegendSort,
      instanceState,
    ],
  );
}
