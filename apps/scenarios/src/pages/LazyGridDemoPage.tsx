import { useCallback, useEffect, useState } from 'react';
import {
  GridPanelLayout,
  TimeRangeContextPicker,
  TimeRangeRefresh,
} from '@grafana/query-ui';

import { DemoPanel } from '../components/DemoPanel';
import { PluginPage } from '../components/PluginPage';

const PANEL_COUNT = 30;

const panelIndexes = Array.from({ length: PANEL_COUNT }, (_, i) => i);

const breadcrumbs = [
  { text: 'Scenarios', url: '/' },
  { text: 'Lazy grid demo' },
];

const actions = (
  <>
    <TimeRangeContextPicker />
    <TimeRangeRefresh />
  </>
);

/**
 * A tall grid in which `GridPanelLayout` mounts each panel only once it
 * scrolls near the viewport. The counter above the grid shows how many panels
 * have mounted, and each mounted panel carries a `lazy-panel-N` test id, so
 * e2e tests can tell mounted panels from placeholders.
 */
export function LazyGridDemoPage() {
  const [mounted, setMounted] = useState<ReadonlySet<number>>(new Set());

  const onMount = useCallback((index: number) => {
    setMounted((prev) => new Set(prev).add(index));
  }, []);

  return (
    <PluginPage
      breadcrumbs={breadcrumbs}
      title="Lazy grid demo"
      description="Panels outside the viewport mount, and query, only once they scroll into view."
      actions={actions}
    >
      <p data-testid="mounted-count">
        Mounted panels: {mounted.size} of {PANEL_COUNT}
      </p>
      <GridPanelLayout isLazy>
        {panelIndexes.map((index) => (
          <TrackedPanel key={index} index={index} onMount={onMount} />
        ))}
      </GridPanelLayout>
    </PluginPage>
  );
}

interface TrackedPanelProps {
  index: number;
  onMount: (index: number) => void;
}

function TrackedPanel({ index, onMount }: TrackedPanelProps) {
  useEffect(() => {
    onMount(index);
  }, [index, onMount]);

  return (
    <div data-testid={`lazy-panel-${index}`} style={{ height: '100%' }}>
      <DemoPanel title={`Panel ${index}`} />
    </div>
  );
}
