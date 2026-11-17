import { useInterpolator, useDataQuery, VizPanel, VariableValueSelect, DataSourceVariable } from '@grafana/scenes2';
import { Stack } from '@grafana/ui';
import React from 'react';

import { PageWrapper } from './PageWrapper';
import { plainTimeSeriesGraph } from './sharedVisualizations';

export function SlowQueryDemo() {
  return (
    <PageWrapper title="Slow query demo">
      <DataSourceVariable name="ds" loading={true} pluginId="grafana-testdata-datasource">
        <SlowQueryGraph />
      </DataSourceVariable>
    </PageWrapper>
  );
}

const SlowQueryGraph = React.memo(function SlowQueryGraph() {
  const [ds, loading] = useInterpolator('${ds}');
  const data = useDataQuery({
    enabled: !loading,
    queries: [{ refId: 'A', datasource: { uid: ds }, scenarioId: 'slow_query', stringInput: '3s' }],
  });

  return (
    <Stack direction="column" gap={3}>
      <Stack justifyContent={'space-between'}>
        <VariableValueSelect name="ds" />
      </Stack>
      <div style={{ height: 400 }}>
        <VizPanel title="Slow query" vizConfig={plainTimeSeriesGraph} data={data.data} />
      </div>
    </Stack>
  );
});
