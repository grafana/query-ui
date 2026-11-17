import { renderHook } from '@testing-library/react';
import {
  createTheme,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  PanelPlugin,
} from '@grafana/data';
import { getPluginImportUtils } from '@grafana/runtime';

import type { VizConfig } from './PanelBuilders/types';
import { useVizPanel } from './useVizPanel';

// The real module drags @grafana/ui into jsdom
vi.mock('@grafana/runtime', () => ({
  config: { theme2: createTheme() },
  getPluginImportUtils: vi.fn(),
}));

const vizConfig = {
  pluginId: 'timeseries',
  options: {},
  fieldConfig: { defaults: {}, overrides: [] },
} as unknown as VizConfig;

function panelData(state: LoadingState): PanelData {
  return { state, series: [], timeRange: getDefaultTimeRange() };
}

function mockPlugin(cached: PanelPlugin | undefined) {
  vi.mocked(getPluginImportUtils).mockReturnValue({
    getPanelPluginFromCache: () => cached,
    // Never resolves, so the plugin stays unloaded for the whole test
    importPanelPlugin: () => new Promise(() => {}),
  } as unknown as ReturnType<typeof getPluginImportUtils>);
}

describe('useVizPanel isLoading', () => {
  beforeEach(() => {
    mockPlugin(new PanelPlugin(() => null));
  });

  it('is true while the query is loading', () => {
    const { result } = renderHook(() =>
      useVizPanel({ vizConfig, data: panelData(LoadingState.Loading) }),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('is true before any data has arrived', () => {
    const { result } = renderHook(() =>
      useVizPanel({ vizConfig, data: undefined }),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('is false once the query is done', () => {
    const { result } = renderHook(() =>
      useVizPanel({ vizConfig, data: panelData(LoadingState.Done) }),
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('switches from true to false when the query finishes', () => {
    const { result, rerender } = renderHook(
      ({ data }: { data?: PanelData }) => useVizPanel({ vizConfig, data }),
      { initialProps: { data: panelData(LoadingState.Loading) } },
    );

    expect(result.current.isLoading).toBe(true);

    rerender({ data: panelData(LoadingState.Done) });

    expect(result.current.isLoading).toBe(false);
  });

  it('is true while the plugin is importing, even with finished data', () => {
    mockPlugin(undefined);

    const { result } = renderHook(() =>
      useVizPanel({ vizConfig, data: panelData(LoadingState.Done) }),
    );

    expect(result.current.isLoading).toBe(true);
  });
});
