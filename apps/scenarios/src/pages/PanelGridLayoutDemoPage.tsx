import { GridPanelLayout } from '@grafana/query-ui';
import { Stack } from '@grafana/ui';

import { DemoPanel } from '../components/DemoPanel';
import { ScenarioPage } from '../components/ScenarioPage';

const panelTitles = ['Panel A', 'Panel B', 'Panel C', 'Panel D'];

/**
 * Vite-app equivalent of apps/demo-app's PanelGridLayoutDemo, querying the
 * fake random-walk data source instead of the testdata plugin.
 * QueryClientProvider, UrlStateProvider and TimeRangeContextProvider live in
 * App.tsx, above the router.
 */
export function PanelGridLayoutDemoPage() {
  return (
    <ScenarioPage
      title="Panel grid layout demo"
      description="Renders a grid of panels backed by a fake random-walk data source."
    >
      <Stack direction="column" gap={2}>
        <GridPanelLayout>
          {panelTitles.map((title) => (
            <DemoPanel key={title} title={title} />
          ))}
        </GridPanelLayout>
      </Stack>
    </ScenarioPage>
  );
}
