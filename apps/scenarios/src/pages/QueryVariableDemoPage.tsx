import { css } from '@emotion/css';
import { Profiler } from 'react';
import {
  QueryVariable,
  useDataQuery,
  useInterpolator,
  VariableValueCombobox,
  VizConfigBuilder,
  VizPanel,
} from '@grafana/query-ui';
import { Stack } from '@grafana/ui';

import { RenderStatsTable } from '../components/RenderStatsTable';
import { ScenarioPage } from '../components/ScenarioPage';
import {
  FAKE_LABELED_DATASOURCE_UID,
  FAKE_TIMESERIES_PANEL_ID,
} from '../grafana/constants';
import type { FakeLabeledQuery } from '../grafana/FakeLabeledDataSource';
import {
  countProfilerRender,
  useCommitCount,
  useRecordValue,
} from '../renderStats/renderStats';

const datasource = { uid: FAKE_LABELED_DATASOURCE_UID };

const fakeTimeSeriesViz = new VizConfigBuilder(
  FAKE_TIMESERIES_PANEL_ID,
  '0.0.0',
).build();

/** The probe ids the e2e tests read back from `window.__renderStats`. */
const Probe = {
  interpolator: 'useInterpolator',
  dataQuery: 'useDataQuery',
  vizPanel: 'VizPanel',
} as const;

/** A string that uses all three variables. */
function InterpolatedProbe() {
  const [value, loading] = useInterpolator('env=$env app=$app pod=$pod');

  useCommitCount(Probe.interpolator);
  useRecordValue(Probe.interpolator, loading ? `${value} (loading)` : value);

  return <div data-testid="interpolated">{value}</div>;
}

/**
 * A data query that uses all three variables, shown in a VizPanel.
 * useDataQuery doesn't interpolate yet, so the expression goes through
 * useInterpolator first, and the query waits while a variable is loading.
 */
function DataQueryProbe() {
  const [expr, loading] = useInterpolator(
    'requests{env="$env", app="$app", pod="$pod"}',
  );
  const queries: FakeLabeledQuery[] = [{ refId: 'A', datasource, expr }];
  const result = useDataQuery({ queries, enabled: !loading });
  const { data, status, fetchStatus } = result;
  const seriesName = data?.series[0]?.name ?? 'no data';

  useCommitCount(Probe.dataQuery);
  useRecordValue(
    Probe.dataQuery,
    `${status}/${fetchStatus} ${data?.state ?? 'no state'} ${seriesName}`,
  );

  return (
    <>
      <div data-testid="data-query">
        {fetchStatus === 'idle' ? seriesName : 'fetching'}
      </div>
      <div className={panelWrapper}>
        <Profiler id={Probe.vizPanel} onRender={countProfilerRender}>
          <VizPanel
            title="Requests"
            vizConfig={fakeTimeSeriesViz}
            data={data}
          />
        </Profiler>
      </div>
    </>
  );
}

const panelWrapper = css({ height: 240 });

/**
 * Three nested query variables against FakeLabeledDataSource, each narrowed
 * down by the ones above it. Options load when a combobox opens, and a
 * variable checks its value again whenever one it references changes: a new
 * env changes the options of app, which changes app, which changes the
 * options and value of pod. Probes count the commits and record the values of
 * a useInterpolator call, a useDataQuery call and the VizPanel it feeds, so
 * the e2e tests can see which queries run and what the cascade costs.
 * The pod combobox allows custom values.
 */
export function QueryVariableDemoPage() {
  return (
    <ScenarioPage
      title="Query variable demo"
      description="Three nested query variables, each depending on the one above. Options load when a combobox opens. Counts the renders a change at the top causes below."
    >
      <QueryVariable
        name="env"
        datasource={datasource}
        query="labelValues(env)"
      >
        <QueryVariable
          name="app"
          datasource={datasource}
          query="labelValues(env=$env, app)"
        >
          <QueryVariable
            name="pod"
            datasource={datasource}
            query="labelValues(env=$env, app=$app, pod)"
          >
            <Stack direction="column" gap={2}>
              <Stack>
                <VariableValueCombobox name="env" />
                <VariableValueCombobox name="app" />
                <VariableValueCombobox name="pod" allowCustomValue />
              </Stack>
              <InterpolatedProbe />
              <DataQueryProbe />
              <RenderStatsTable />
            </Stack>
          </QueryVariable>
        </QueryVariable>
      </QueryVariable>
    </ScenarioPage>
  );
}
