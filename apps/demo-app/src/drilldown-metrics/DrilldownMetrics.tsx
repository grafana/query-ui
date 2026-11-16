import {
  useInterpolator,
  VariableValueSelect,
  DataSourceVariable,
  DefineVariable,
  useVariable,
  useVariableOptionsQuery,
  VizPanel,
  PanelGridLayout,
  type VariableValue,
} from '@grafana/scenes2';
import { LinkButton, Stack } from '@grafana/ui';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { PageWrapper } from '../components/PageWrapper';
import { plainTimeSeriesGraph } from '../components/sharedVisualizations';
import { MetricScene } from './MetricScene';
import { VAR_METRIC } from './shared/shared';
import { useMetricData } from './useMetricData';

/** Caps the number of panels so a large Prometheus instance doesn't fire thousands of queries. */
const MAX_PANELS = 50;

export function DrilldownMetrics() {
  return (
    <PageWrapper title="Drilldown Metrics">
      <DataSourceVariable name="ds" loading={true} pluginId="prometheus">
        <DefineVariable name={VAR_METRIC}>
          <MetricView />
        </DefineVariable>
      </DataSourceVariable>
    </PageWrapper>
  );
}

/** Shows the selected metric, or the list of metrics to pick from when none is selected. */
function MetricView() {
  const metric = useVariable<VariableValue>(VAR_METRIC).value.value;

  return (
    <Stack direction="column" gap={3}>
      <Stack justifyContent={'space-between'}>
        <VariableValueSelect name="ds" />
      </Stack>
      {metric ? <MetricScene metric={String(metric)} /> : <MetricSelect />}
    </Stack>
  );
}

const MetricSelect = React.memo(function MetricSelect() {
  const [ds, loading] = useInterpolator('${ds}');

  // const query = `label_values({${VAR_FILTERS}}, __name__)`;
  const query = `label_values({}, __name__)`;

  const metrics = useVariableOptionsQuery({
    enabled: !loading,
    datasource: { uid: ds },
    query: query,
  });

  return (
    <>
      {metrics.isError && <pre>{metrics.error.message}</pre>}
      {metrics.data && (
        <PanelGridLayout>
          {metrics.data.slice(0, MAX_PANELS).map((metric) => (
            <MetricPanel key={String(metric.value)} metric={String(metric.value)} dsUid={ds} />
          ))}
        </PanelGridLayout>
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
