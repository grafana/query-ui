import {
  DefineVariable,
  useInterpolator,
  useDataQuery,
  VizPanel,
  VariableValueCombobox,
  VariableValueMultiCombobox,
  VariableTestQuery,
  GridPanelLayout,
} from '@grafana/query-ui';
import { Stack } from '@grafana/ui';
import React from 'react';

import { PageWrapper } from './PageWrapper';
import { plainTimeSeriesGraph } from './sharedVisualizations';

const podOptions = [
  { value: 'pod1', label: 'Pod 1' },
  { value: 'pod2', label: 'Pod 2' },
  { value: 'pod3', label: 'Pod 3' },
];

export function VariablesDemo() {
  return (
    <PageWrapper title="Variables demo">
      <DefineVariable name="service" loading={true}>
        <VariableTestQuery name="service" query="A.*" delay={2000} />
        <DefineVariable name="pod" value={podOptions.slice(0, 2)} options={podOptions}>
          <div>
            <Stack direction="column" gap={3}>
              <Stack>
                <VariableValueCombobox name="service" />
                <VariableValueMultiCombobox name="pod" />
              </Stack>
              <GridPanelLayout>
                <RenderPanel />
              </GridPanelLayout>
            </Stack>
          </div>
        </DefineVariable>
      </DefineVariable>
    </PageWrapper>
  );
}

const RenderPanel = React.memo(function RenderPanel() {
  const [alias, loading] = useInterpolator('service=${service} pod=${pod}');
  const data = useDataQuery({
    enabled: !loading,
    queries: [
      {
        refId: 'A',
        datasource: { uid: 'PD8C576611E62080A' },
        scenarioId: 'random_walk',
        alias: alias,
      },
    ],
    maxDataPoints: 30,
  });

  return <VizPanel title="Test graph" vizConfig={plainTimeSeriesGraph} data={data.data} />;
});
