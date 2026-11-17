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
import { Field, LinkButton, Stack } from '@grafana/ui';
import React from 'react';
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
              <Stack direction="column" gap={3}>
                <Stack>
                  <VariableValueSelect name="ds" />
                  <Field label="Filters">
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

  return metric ? <MetricScene metric={String(metric)} /> : <MetricSelect />;
}

const MetricSelect = React.memo(function MetricSelect() {
  const [ds, loading] = useInterpolator('${ds}');
  const [query, _] = useInterpolator(`label_values({$${VAR_FILTERS}}, __name__)`);

  const metrics = useVariableOptionsQuery({
    enabled: !loading,
    datasource: { uid: ds },
    query: query,
  });

  return (
    <>
      {metrics.isError && <pre>{metrics.error.message}</pre>}
      {metrics.data && (
        <GridPanelLayout isLazy>
          {metrics.data.slice(0, MAX_PANELS).map((metric) => (
            <MetricPanel key={String(metric.value)} metric={String(metric.value)} dsUid={ds} />
          ))}
        </GridPanelLayout>
      )}
    </>
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
