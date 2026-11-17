import {
  useInterpolator,
  VariableValueSelect,
  DataSourceVariable,
  DefineVariable,
  useVariable,
  useVariableOptionsQuery,
  VizPanel,
  GridPanelLayout,
  type VariableValue,
  AdhocFiltersProvider,
  AdHocFiltersCombobox,
  AdhocFiltersVariable,
} from '@grafana/scenes2';
import type { SelectableValue } from '@grafana/data';
import { Box, Field, Icon, Input, LinkButton, RadioButtonGroup, Stack } from '@grafana/ui';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { PageWrapper } from '../components/PageWrapper';
import { plainTimeSeriesGraph } from '../components/sharedVisualizations';
import { MetricScene } from './MetricScene';
import { VAR_FILTERS, VAR_METRIC, trailDS } from './shared/shared';
import { useMetricData } from './useMetricData';

/** Caps the number of panels so a large Prometheus instance doesn't fire thousands of queries. */
const MAX_PANELS = 50;

export function DrilldownMetrics() {
  return (
    <PageWrapper title="Drilldown Metrics">
      <DataSourceVariable name="ds" loading={true} pluginId="prometheus">
        <AdhocFiltersProvider datasource={trailDS}>
          <AdhocFiltersVariable name={VAR_FILTERS}>
            <DefineVariable name={VAR_METRIC}>
              <Stack direction="column" gap={2}>
                <Stack>
                  <VariableValueSelect name="ds" />
                  <Field label="Filters" noMargin>
                    <AdHocFiltersCombobox />
                  </Field>
                </Stack>
                <ViewRenderer />
              </Stack>
            </DefineVariable>
          </AdhocFiltersVariable>
        </AdhocFiltersProvider>
      </DataSourceVariable>
    </PageWrapper>
  );
}

/** Shows the selected metric, or the list of metrics to pick from when none is selected. */
function ViewRenderer() {
  const metric = useVariable<VariableValue>(VAR_METRIC).value.value;

  return metric ? (
    // Keeps the original spacing below the variables, which the parent gap no longer provides.
    <Box paddingTop={0}>
      <MetricScene metric={String(metric)} />
    </Box>
  ) : (
    <MetricSelect />
  );
}

const SEARCH_DEBOUNCE_MS = 300;

/** Returns `value`, but only after it has stopped changing for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

type LayoutMode = 'grid' | 'rows';

const layoutOptions: Array<SelectableValue<LayoutMode>> = [
  { label: 'Grid', value: 'grid' },
  { label: 'Rows', value: 'rows' },
];

/** Grid fits as many columns as possible, rows stacks the panels in a single column. */
const GRID_TEMPLATE_COLUMNS: Record<LayoutMode, string> = {
  grid: 'repeat(auto-fit, minmax(400px, 1fr))',
  rows: '1fr',
};

const MetricSelect = React.memo(function MetricSelect() {
  const [ds, loading] = useInterpolator('${ds}');
  const [query, _] = useInterpolator(`label_values({$${VAR_FILTERS}}, __name__)`);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const [layout, setLayout] = useState<LayoutMode>('grid');

  const metrics = useVariableOptionsQuery({
    enabled: !loading,
    datasource: { uid: ds },
    query: query,
  });

  const filteredMetrics = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = metrics.data ?? [];
    return needle ? all.filter((metric) => String(metric.value).toLowerCase().includes(needle)) : all;
  }, [metrics.data, search]);

  return (
    <Stack direction="column" gap={3}>
      <Stack gap={2} alignItems="center">
        <div style={{ flexGrow: 1 }}>
          <Input
            prefix={<Icon name="search" />}
            suffix={
              searchInput ? (
                <Icon
                  name="times"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                />
              ) : undefined
            }
            value={searchInput}
            placeholder="Search metrics"
            onChange={(evt) => setSearchInput(evt.currentTarget.value)}
          />
        </div>
        <RadioButtonGroup options={layoutOptions} value={layout} onChange={setLayout} />
        {metrics.data && (
          <span>
            {filteredMetrics.length > MAX_PANELS
              ? `Showing ${MAX_PANELS} of ${filteredMetrics.length} metrics`
              : `${filteredMetrics.length} metrics`}
          </span>
        )}
      </Stack>
      {metrics.isError && <pre>{metrics.error.message}</pre>}
      {metrics.data && (
        <GridPanelLayout isLazy templateColumns={GRID_TEMPLATE_COLUMNS[layout]}>
          {filteredMetrics.slice(0, MAX_PANELS).map((metric) => (
            <MetricPanel key={String(metric.value)} metric={String(metric.value)} dsUid={ds} />
          ))}
        </GridPanelLayout>
      )}
    </Stack>
  );
});

interface MetricPanelProps {
  metric: string;
  dsUid: string;
}

const MetricPanel = React.memo(function MetricPanel({ metric, dsUid }: MetricPanelProps) {
  const data = useMetricData(metric, dsUid);
  const location = useLocation();

  // Keeps the other query parameters, like the time range and data source
  const getSelectUrl = () => {
    const params = new URLSearchParams(location.search);
    params.set(`var-${VAR_METRIC}`, metric);
    return `${location.pathname}?${params.toString()}`;
  };

  return (
    <VizPanel
      title={metric}
      vizConfig={plainTimeSeriesGraph}
      data={data.data}
      actions={
        <LinkButton size="sm" variant="secondary" href={getSelectUrl()}>
          Select
        </LinkButton>
      }
    />
  );
});
