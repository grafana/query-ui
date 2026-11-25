import { useDataQuery, VizConfigBuilder, VizPanel } from '@grafana/query-ui';

import { ScenarioPage } from '../components/ScenarioPage';
import {
  FAKE_RANDOM_WALK_DATASOURCE_UID,
  FAKE_TIMESERIES_PANEL_ID,
} from '../grafana/constants';

const fakeTimeSeriesViz = new VizConfigBuilder(
  FAKE_TIMESERIES_PANEL_ID,
  '0.0.0',
).build();

/**
 * One panel with three series and a legend. Clicking a legend item shows only
 * that series; clicking it again shows them all.
 */
export function ManySeriesDemoPage() {
  const data = useDataQuery({
    queries: [
      {
        refId: 'A',
        datasource: { uid: FAKE_RANDOM_WALK_DATASOURCE_UID },
        seriesCount: 3,
      },
    ],
    maxDataPoints: 30,
  });

  return (
    <ScenarioPage
      title="Many series demo"
      description="A panel with several series. Click a legend item to toggle series visibility."
    >
      {/* VizPanel fills its parent, and PluginPage gives it no height */}
      <div style={{ height: 400 }}>
        <VizPanel
          title="Random walk"
          vizConfig={fakeTimeSeriesViz}
          data={data.data}
        />
      </div>
    </ScenarioPage>
  );
}
