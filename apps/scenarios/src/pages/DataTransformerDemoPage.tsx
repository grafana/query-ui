import { css } from '@emotion/css';
import { Profiler, useState } from 'react';
import type { DataTransformerConfig } from '@grafana/data';
import {
  useDataQuery,
  useDataTransformer,
  VizConfigBuilder,
  VizPanel,
} from '@grafana/query-ui';
import { InlineSwitch, Stack } from '@grafana/ui';

import { RenderStatsTable } from '../components/RenderStatsTable';
import { ScenarioPage } from '../components/ScenarioPage';
import {
  FAKE_RANDOM_WALK_DATASOURCE_UID,
  FAKE_TIMESERIES_PANEL_ID,
} from '../grafana/constants';
import {
  countProfilerRender,
  useCommitCount,
  useRecordValue,
} from '../renderStats/renderStats';

const fakeTimeSeriesViz = new VizConfigBuilder(
  FAKE_TIMESERIES_PANEL_ID,
  '0.0.0',
).build();

const queries = [
  { refId: 'A', datasource: { uid: FAKE_RANDOM_WALK_DATASOURCE_UID } },
];

// Module constants, so the hook gets the same arrays on every render.
const noTransformations: DataTransformerConfig[] = [];
const limitTo10: DataTransformerConfig[] = [
  { id: 'limit', options: { limitField: 10 } },
];

/** The probe ids the e2e tests read back from `window.__renderStats`. */
const Probe = {
  panel: 'TransformedPanel',
  vizPanel: 'VizPanel',
} as const;

/**
 * Queries the fake random-walk data source, runs the result through
 * useDataTransformer, and shows it in a VizPanel.
 */
function TransformedPanel({ transform }: { transform: boolean }) {
  const query = useDataQuery({ queries, maxDataPoints: 30 });
  const data = useDataTransformer(
    transform ? limitTo10 : noTransformations,
    query.data,
  );
  const rows = data?.series[0]?.length ?? 0;

  useCommitCount(Probe.panel);
  useRecordValue(Probe.panel, `${data?.state ?? 'no data'} ${rows} rows`);

  return (
    <>
      <div data-testid="row-count">{rows} rows</div>
      <div className={panelWrapper}>
        <Profiler id={Probe.vizPanel} onRender={countProfilerRender}>
          <VizPanel
            title="Random walk"
            vizConfig={fakeTimeSeriesViz}
            data={data}
          />
        </Profiler>
      </div>
    </>
  );
}

/**
 * One panel whose data goes through useDataTransformer. The switch adds a
 * limit transformation, so the e2e test can compare the renders of a refresh
 * with and without it.
 */
export function DataTransformerDemoPage() {
  const [transform, setTransform] = useState(false);

  return (
    <ScenarioPage
      title="Data transformer demo"
      description="A panel whose data goes through useDataTransformer. Toggle the transformation to compare the renders a refresh causes."
    >
      <Stack direction="column" gap={2}>
        <InlineSwitch
          label="Limit to 10 rows"
          showLabel
          value={transform}
          onChange={() => setTransform((value) => !value)}
        />
        <TransformedPanel transform={transform} />
        <RenderStatsTable />
      </Stack>
    </ScenarioPage>
  );
}

const panelWrapper = css({ height: 240 });
