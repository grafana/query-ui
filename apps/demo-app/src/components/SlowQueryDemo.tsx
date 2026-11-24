import {
  useInterpolator,
  useDataQuery,
  VizPanel,
  VariableValueCombobox,
  DataSourceVariable,
  GridPanelLayout,
} from '@grafana/query-ui';
import { Stack } from '@grafana/ui';
import React from 'react';

import { PageWrapper } from './PageWrapper';
import { plainTimeSeriesGraph } from './sharedVisualizations';

export function SlowQueryDemo() {
  return (
    <PageWrapper title="Slow query demo">
      <DataSourceVariable name="ds" loading={true} pluginId="grafana-testdata-datasource">
        <Stack direction="column" gap={3}>
          <Stack justifyContent={'space-between'}>
            <VariableValueCombobox name="ds" />
          </Stack>
          <GridPanelLayout>
            <SlowQueryGraph name="Latency" />
            <SlowQueryGraph name="Errors" />
          </GridPanelLayout>
        </Stack>
      </DataSourceVariable>
    </PageWrapper>
  );
}

const SlowQueryGraph = React.memo(function SlowQueryGraph(props: { name: string }) {
  const [ds, loading] = useInterpolator('${ds}');
  const data = useDataQuery({
    enabled: !loading,
    queries: [{ refId: 'A', datasource: { uid: ds }, scenarioId: 'slow_query', stringInput: '3s', alias: props.name }],
  });

  return <VizPanel title={props.name} vizConfig={plainTimeSeriesGraph} data={data.data} />;
});
