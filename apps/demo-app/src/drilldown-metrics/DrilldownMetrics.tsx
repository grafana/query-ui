import { useInterpolator, VariableValueSelect, DataSourceVariable, useVariableOptionsQuery } from '@grafana/scenes2';
import { Stack } from '@grafana/ui';
import React from 'react';

import { PageWrapper } from '../components/PageWrapper';

export function DrilldownMetrics() {
  return (
    <PageWrapper title="Drilldown Metrics">
      <DataSourceVariable name="ds" loading={true} pluginId="prometheus">
        <MetricSelect />
      </DataSourceVariable>
    </PageWrapper>
  );
}

const MetricSelect = React.memo(function QueryAndGraph() {
  const [ds, loading] = useInterpolator('${ds}');

  // const query = `label_values({${VAR_FILTERS}}, __name__)`;
  const query = `label_values({}, __name__)`;

  const metrics = useVariableOptionsQuery({
    enabled: !loading,
    datasource: { uid: ds },
    query: query,
  });

  return (
    <div>
      <Stack direction="column" gap={3}>
        <Stack justifyContent={'space-between'}>
          <VariableValueSelect name="ds" />
        </Stack>
        {metrics.isError && <pre>{metrics.error.message}</pre>}
        {metrics.data && (
          <Stack direction="column" gap={3}>
            {metrics.data.map((metric) => (
              <div key={String(metric.value)}>{metric.value}</div>
            ))}
          </Stack>
        )}
      </Stack>
    </div>
  );
});
