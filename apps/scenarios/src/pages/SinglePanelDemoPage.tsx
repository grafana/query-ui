import { DemoPanel } from '../components/DemoPanel';
import { ScenarioPage } from '../components/ScenarioPage';

export function SinglePanelDemoPage() {
  return (
    <ScenarioPage
      title="Single panel demo"
      description="Renders a single panel backed by a fake random-walk data source."
    >
      <DemoPanel title="Panel A" />
    </ScenarioPage>
  );
}
