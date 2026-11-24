import {
  DefineVariable,
  useInterpolator,
  VariableValueCombobox,
  VariableValueMultiCombobox,
} from '@grafana/query-ui';
import { Stack } from '@grafana/ui';

import { PluginPage } from '../components/PluginPage';

const breadcrumbs = [{ text: 'Scenarios', url: '/' }, { text: 'Variables demo' }];

const serviceOptions = [
  { value: 'api', label: 'API' },
  { value: 'web', label: 'Web' },
  { value: 'db', label: 'DB' },
];

const podOptions = [
  { value: 'pod1', label: 'Pod 1' },
  { value: 'pod2', label: 'Pod 2' },
  { value: 'pod3', label: 'Pod 3' },
];

/** Both variables run through the interpolator, so a test can read them back. */
function Interpolated() {
  const [values] = useInterpolator('service=${service} pod=${pod:csv}');
  const [labels] = useInterpolator('${service:text} / ${pod:text}');

  return (
    <div>
      <div data-testid="interpolated">{values}</div>
      <div data-testid="labels">{labels}</div>
    </div>
  );
}

/**
 * A single-value and a multi-value variable with static options, picked with
 * VariableValueCombobox and VariableValueMultiCombobox and synced to the URL.
 */
export function VariablesDemoPage() {
  return (
    <PluginPage
      breadcrumbs={breadcrumbs}
      title="Variables demo"
      description="Picks a single-value and a multi-value variable from static options and syncs both to the URL."
    >
      <DefineVariable
        name="service"
        value={serviceOptions[0]}
        options={serviceOptions}
      >
        <DefineVariable name="pod" value={[podOptions[0]]} options={podOptions}>
          <Stack direction="column" gap={2}>
            <Stack>
              <VariableValueCombobox name="service" />
              <VariableValueMultiCombobox name="pod" />
            </Stack>
            <Interpolated />
          </Stack>
        </DefineVariable>
      </DefineVariable>
    </PluginPage>
  );
}
