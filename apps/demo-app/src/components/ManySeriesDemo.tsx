import { useDataQuery, VizPanel } from '@grafana/query-ui';

import { PageWrapper } from './PageWrapper';
import { plainTimeSeriesGraph } from './sharedVisualizations';

/** A panel with several series, for trying legend interactions such as toggling series visibility. */
export function ManySeriesDemo() {
  const data = useDataQuery({
    queries: [
      {
        refId: 'A',
        datasource: { uid: 'PD8C576611E62080A' },
        scenarioId: 'random_walk',
        seriesCount: 3,
      },
    ],
  });

  return (
    <PageWrapper title="Many series demo">
      <div style={{ height: 400 }}>
        <VizPanel title="Random walk" vizConfig={plainTimeSeriesGraph} data={data.data} />
      </div>
    </PageWrapper>
  );
}
