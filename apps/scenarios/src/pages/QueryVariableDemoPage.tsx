import {
  QueryVariable,
  useInterpolator,
  VariableValueCombobox,
  VariableValueMultiCombobox,
} from '@grafana/query-ui';
import { Stack } from '@grafana/ui';

import { ScenarioPage } from '../components/ScenarioPage';
import { FAKE_LABELED_DATASOURCE_UID } from '../grafana/constants';
import { useFakeVariableQueries } from '../grafana/fakeVariableQueries';

const datasource = { uid: FAKE_LABELED_DATASOURCE_UID };

/** Both variables run through the interpolator, so a test can read them back. */
function Interpolated() {
  const [values] = useInterpolator(
    'label=${label} labelValue=${labelValue:csv}',
  );

  return <div data-testid="interpolated">{values}</div>;
}

/**
 * Every variable query the data source has received, in order, so a test can
 * tell when options load.
 */
function VariableQueries() {
  const queries = useFakeVariableQueries();

  return (
    <>
      <h4>Issued variable queries</h4>
      <Stack
        data-testid="variable-queries"
        aria-label="Variable queries"
        direction="column"
        gap={1}
      >
        {queries.map(({ query, searchFilter }, index) => (
          <div key={index} role="listitem">
            {searchFilter ? `${query} (search: ${searchFilter})` : query}
          </div>
        ))}
      </Stack>
    </>
  );
}

/**
 * Two nested query variables against FakeLabeledDataSource. The outer,
 * single-value one lists the label names with `labels()`. The inner,
 * multi-value one lists the values of the label the outer one holds with
 * `labelValues(${label})`.
 * Options load when a combobox opens, filtered by what the user types, and the
 * inner values are checked again whenever the outer one changes.
 */
export function QueryVariableDemoPage() {
  return (
    <ScenarioPage
      title="Query variable demo"
      description="Two nested query variables, where the inner query depends on the outer variable. Options load when a combobox opens."
    >
      <QueryVariable name="label" datasource={datasource} query="labels()">
        <QueryVariable
          name="labelValue"
          datasource={datasource}
          query="labelValues(${label})"
          value={[]}
        >
          <Stack direction="column" gap={2}>
            <Stack>
              <VariableValueCombobox name="label" />
              <VariableValueMultiCombobox name="labelValue" />
            </Stack>
            <Interpolated />
            <VariableQueries />
          </Stack>
        </QueryVariable>
      </QueryVariable>
    </ScenarioPage>
  );
}
