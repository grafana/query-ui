import {
  QueryVariable,
  useInterpolator,
  VariableValueCombobox,
} from '@grafana/query-ui';
import { Stack } from '@grafana/ui';

import { PluginPage } from '../components/PluginPage';
import { FAKE_LABELED_DATASOURCE_UID } from '../grafana/constants';

const breadcrumbs = [
  { text: 'Scenarios', url: '/' },
  { text: 'Query variable demo' },
];

const datasource = { uid: FAKE_LABELED_DATASOURCE_UID };

/** Both variables run through the interpolator, so a test can read them back. */
function Interpolated() {
  const [values] = useInterpolator('label=${label} labelValue=${labelValue}');

  return <div data-testid="interpolated">{values}</div>;
}

/**
 * Two nested single-value query variables against FakeLabeledDataSource. The
 * outer one lists the label names, and the inner one lists the values of the
 * label the outer one holds, so its query references `${label}`. Options load
 * when a combobox opens, filtered by what the user types, and the inner value
 * is checked again whenever the outer one changes.
 */
export function QueryVariableDemoPage() {
  return (
    <PluginPage
      breadcrumbs={breadcrumbs}
      title="Query variable demo"
      description="Two nested query variables, where the inner query depends on the outer variable. Options load when a combobox opens."
    >
      <QueryVariable name="label" datasource={datasource} query="__keys">
        <QueryVariable
          name="labelValue"
          datasource={datasource}
          query="${label}"
        >
          <Stack direction="column" gap={2}>
            <Stack>
              <VariableValueCombobox name="label" />
              <VariableValueCombobox name="labelValue" />
            </Stack>
            <Interpolated />
          </Stack>
        </QueryVariable>
      </QueryVariable>
    </PluginPage>
  );
}
