import { css } from '@emotion/css';
import {
  type DataFrame,
  type Field,
  FieldType,
  getFieldDisplayName,
  type GrafanaTheme2,
  LoadingState,
  PanelPlugin,
  type PanelProps,
} from '@grafana/data';
import {
  commonOptionsBuilder,
  type HideableFieldConfig,
  LegendDisplayMode,
  useStyles2,
  VizLegend,
  type VizLegendItem,
} from '@grafana/ui';

import { useCommitCount } from '../renderStats/renderStats';
import { FAKE_TIMESERIES_PANEL_ID } from './constants';
import { createFakePanelPluginMeta } from './pluginMeta';

/**
 * Minimal panel renderer, standing in for a real @grafana/data panel plugin
 * (e.g. the built-in timeseries panel, which is loaded via SystemJS in a real
 * Grafana instance and isn't reachable from this Vite app). Draws each numeric
 * field in a series as an inline SVG sparkline, just enough to see that
 * VizPanel received real data.
 */
function FakeTimeSeriesPanel({ data, width, height }: PanelProps) {
  const styles = useStyles2(getStyles);

  // How often VizPanel renders the panel plugin itself, for the e2e tests
  useCommitCount('FakeTimeSeriesPanel');

  if (data.state === LoadingState.Loading && data.series.length === 0) {
    return <div className={styles.message}>Loading…</div>;
  }

  if (data.state === LoadingState.Error) {
    return (
      <div className={styles.message}>
        {data.error?.message ?? 'Query failed'}
      </div>
    );
  }

  if (data.series.length === 0) {
    return <div className={styles.message}>No data</div>;
  }

  const series = getSeries(data.series);
  const legendItems: VizLegendItem[] = series.map(({ name, field }) => ({
    label: name,
    fieldName: name,
    yAxis: 1,
    disabled: isHiddenFromViz(field),
  }));

  return (
    <div className={styles.wrapper} style={{ width, height }}>
      <div className={styles.graph}>
        {series
          .filter(({ field }) => !isHiddenFromViz(field))
          .map(({ name, field }) => (
            <Sparkline key={name} name={name} field={field} />
          ))}
      </div>
      {legendItems.length > 0 && (
        <VizLegend
          placement="bottom"
          displayMode={LegendDisplayMode.List}
          items={legendItems}
        />
      )}
    </div>
  );
}

interface Series {
  name: string;
  field: Field;
}

/** The first numeric field of each frame, named the way legends name it. */
function getSeries(frames: DataFrame[]): Series[] {
  return frames.flatMap((frame) => {
    const field = frame.fields.find((f) => f.type === FieldType.number);
    return field
      ? [{ name: getFieldDisplayName(field, frame, frames), field }]
      : [];
  });
}

// Set by the series-visibility override VizPanel adds on a legend click.
function isHiddenFromViz(field: Field<unknown>): boolean {
  const custom = field.config.custom as HideableFieldConfig | undefined;
  return custom?.hideFrom?.viz === true;
}

function Sparkline({ name, field }: Series) {
  const styles = useStyles2(getStyles);

  if (field.values.length === 0) {
    return null;
  }

  const values = field.values as number[];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((value, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className={styles.series} data-testid={`fake-series ${name}`}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={styles.svg}
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    color: theme.colors.text.primary,
  }),
  graph: css({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    padding: theme.spacing(1),
  }),
  message: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.text.secondary,
  }),
  series: css({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }),
  seriesName: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  svg: css({
    flex: 1,
    width: '100%',
    color: theme.colors.primary.main,
  }),
});

export const fakeTimeSeriesPanelPlugin = new PanelPlugin(FakeTimeSeriesPanel);
fakeTimeSeriesPanelPlugin.meta = createFakePanelPluginMeta(
  FAKE_TIMESERIES_PANEL_ID,
  'Fake time series',
);
// Registers custom.hideFrom, so applyFieldOverrides keeps the property the
// legend's series-visibility override sets.
fakeTimeSeriesPanelPlugin.useFieldConfig({
  useCustomConfig: (builder) => {
    commonOptionsBuilder.addHideFrom(builder);
  },
});
