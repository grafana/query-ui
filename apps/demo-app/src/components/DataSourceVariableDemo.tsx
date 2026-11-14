import { useInterpolator, useDataQuery, VizPanel, VariableValueSelect, DataSourceVariable } from '@grafana/scenes2';
import { Stack } from '@grafana/ui';
import React from 'react';

import { PageWrapper } from './PageWrapper';
import { plainTimeSeriesGraph } from './sharedVisualizations';

export function DataSourceVariableDemo() {
  return (
    <PageWrapper title="Data Source variables demo">
      <DataSourceVariable name="ds" loading={true} pluginId="grafana-testdata-datasource">
        <QueryAndGraph />
      </DataSourceVariable>
    </PageWrapper>
  );
}

const QueryAndGraph = React.memo(function QueryAndGraph() {
  const [ds, loading] = useInterpolator('${ds}');
  const data = useDataQuery({
    enabled: !loading,
    queries: [
      {
        refId: 'A',
        datasource: { uid: ds },
        scenarioId: 'random_walk',
        alias: ds,
      },
    ],
    maxDataPoints: 30,
  });

  return (
    <div>
      <Stack direction="column" gap={3}>
        <Stack justifyContent={'space-between'}>
          <VariableValueSelect name="ds" />
        </Stack>
        <div style={{ height: 400 }}>
          <VizPanel title="Test graph" vizConfig={plainTimeSeriesGraph} data={data.data} />
        </div>
      </Stack>
    </div>
  );
});
