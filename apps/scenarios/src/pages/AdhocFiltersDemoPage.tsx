import {
  AdhocFiltersProvider,
  AdHocFiltersCombobox,
  useDataQuery,
  VizConfigBuilder,
  VizPanel,
} from '@grafana/query-ui';
import { Stack } from '@grafana/ui';

import { ScenarioPage } from '../components/ScenarioPage';
import {
  FAKE_LABELED_DATASOURCE_UID,
  FAKE_TIMESERIES_PANEL_ID,
} from '../grafana/constants';

const fakeTimeSeriesViz = new VizConfigBuilder(
  FAKE_TIMESERIES_PANEL_ID,
  '0.0.0',
).build();

/** Panel A, filtered by whatever AdHocFiltersCombobox has committed to context. */
function FilteredPanel() {
  const data = useDataQuery({
    queries: [
      {
        refId: 'A',
        datasource: { uid: FAKE_LABELED_DATASOURCE_UID },
        alias: 'Panel A',
      },
    ],
    maxDataPoints: 30,
  });

  return (
    <VizPanel title="Panel A" vizConfig={fakeTimeSeriesViz} data={data.data} />
  );
}

/**
 * Exercises AdHocFiltersCombobox end to end against FakeLabeledDataSource:
 * picking a key/operator/value queries getTagKeys/getTagValues, and the
 * committed filters show up in the panel's series name via
 * DataQueryRequest.filters.
 */
export function AdhocFiltersDemoPage() {
  return (
    <ScenarioPage
      title="Adhoc filters demo"
      description="Filters a panel with AdHocFiltersCombobox against a fake data source that implements getTagKeys and getTagValues."
    >
      <AdhocFiltersProvider datasource={{ uid: FAKE_LABELED_DATASOURCE_UID }}>
        <Stack direction="column" gap={2}>
          <AdHocFiltersCombobox />
          <FilteredPanel />
        </Stack>
      </AdhocFiltersProvider>
    </ScenarioPage>
  );
}
