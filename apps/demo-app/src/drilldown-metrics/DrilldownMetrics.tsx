import {
  VariableValueSelect,
  DataSourceVariable,
  DefineVariable,
  useVariable,
  type VariableValue,
  AdhocFiltersProvider,
  AdHocFiltersCombobox,
  AdhocFiltersVariable,
} from '@grafana/scenes2';
import { Box, Field, Stack } from '@grafana/ui';

import { PageWrapper } from '../components/PageWrapper';
import { MetricScene } from './MetricScene';
import { MetricSelect } from './MetricSelect';
import { VAR_FILTERS, VAR_METRIC, trailDS } from './shared/shared';

export function DrilldownMetrics() {
  return (
    <PageWrapper title="Drilldown Metrics">
      <DataSourceVariable name="ds" loading={true} pluginId="prometheus">
        <AdhocFiltersProvider datasource={trailDS}>
          <AdhocFiltersVariable name={VAR_FILTERS}>
            <DefineVariable name={VAR_METRIC}>
              <Stack direction="column" gap={2}>
                <Stack>
                  <VariableValueSelect name="ds" />
                  <Field label="Filters" noMargin>
                    <AdHocFiltersCombobox />
                  </Field>
                </Stack>
                <ViewRenderer />
              </Stack>
            </DefineVariable>
          </AdhocFiltersVariable>
        </AdhocFiltersProvider>
      </DataSourceVariable>
    </PageWrapper>
  );
}

/** Shows the selected metric, or the list of metrics to pick from when none is selected. */
function ViewRenderer() {
  const metric = useVariable<VariableValue>(VAR_METRIC).value.value;

  return metric ? (
    // Keeps the original spacing below the variables, which the parent gap no longer provides.
    <Box paddingTop={0}>
      <MetricScene metric={String(metric)} />
    </Box>
  ) : (
    <MetricSelect />
  );
}
