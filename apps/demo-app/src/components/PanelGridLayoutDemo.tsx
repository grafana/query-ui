import { GridPanelLayout, useDataQuery, VizConfigBuilders, VizPanel } from '@grafana/query-ui';

import { PageWrapper } from './PageWrapper';

const timeSeriesViz = VizConfigBuilders.timeseries().build();

const panelTitles = ['Panel A', 'Panel B', 'Panel C', 'Panel D'];

export function PanelGridLayoutDemo() {
  return (
    <PageWrapper title="Panel grid layout demo">
      <GridPanelLayout>
        {panelTitles.map((title) => (
          <DemoPanel key={title} title={title} />
        ))}
      </GridPanelLayout>
    </PageWrapper>
  );
}

function DemoPanel({ title }: { title: string }) {
  const data = useDataQuery({
    queries: [
      {
        refId: 'A',
        datasource: { uid: 'PD8C576611E62080A' },
        scenarioId: 'random_walk',
        alias: title,
        seriesCount: 10,
      },
    ],
    maxDataPoints: 30,
  });

  return <VizPanel title={title} vizConfig={timeSeriesViz} data={data.data} />;
}
