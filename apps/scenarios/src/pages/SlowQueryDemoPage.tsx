import { useSearchParams } from 'react-router-dom';
import {
  GridPanelLayout,
  TimeRangeContextPicker,
  TimeRangeRefresh,
} from '@grafana/scenes2';

import { DemoPanel } from '../components/DemoPanel';
import { PluginPage } from '../components/PluginPage';
import { useFakeQueryStats } from '../grafana/fakeQueryStats';

const panelTitles = ['Slow A', 'Slow B'];

/** Long enough to cancel a panel's query by hand once its cancel button shows. */
const defaultDelayMs = 10_000;

const breadcrumbs = [
  { text: 'Scenarios', url: '/' },
  { text: 'Slow query demo' },
];

const actions = (
  <>
    <TimeRangeContextPicker />
    <TimeRangeRefresh />
  </>
);

/**
 * Panels whose queries take `defaultDelayMs` to answer, or `?delayMs=` from the
 * URL. While they run, the refresh button cancels all of them and each panel
 * header has its own cancel button. The counter shows how the fake data source
 * saw each query end, so e2e tests can tell a canceled query from one whose
 * result was only ignored.
 */
export function SlowQueryDemoPage() {
  const [searchParams] = useSearchParams();
  const delayMs = Number(searchParams.get('delayMs') ?? defaultDelayMs);
  const stats = useFakeQueryStats();

  return (
    <PluginPage
      breadcrumbs={breadcrumbs}
      title="Slow query demo"
      description="Slow queries that can be canceled from a panel or from the refresh button."
      actions={actions}
    >
      <p data-testid="query-stats">
        Running: {stats.running}, completed: {stats.completed}, canceled:{' '}
        {stats.canceled}
      </p>
      <GridPanelLayout>
        {panelTitles.map((title) => (
          <DemoPanel key={title} title={title} delayMs={delayMs} />
        ))}
      </GridPanelLayout>
    </PluginPage>
  );
}
