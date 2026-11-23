import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  createTheme,
  type FieldConfigPropertyItem,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  PanelPlugin,
  standardFieldConfigEditorRegistry,
  toDataFrame,
} from '@grafana/data';
import { getPluginImportUtils } from '@grafana/runtime';

import { TimeRangeContextProvider } from '../../time/TimeRangeContext';
import { DefineVariable } from '../../variables/DefineVariable';
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

// useVizPanel requires a time range provider above it
function TimeRangeWrapper({ children }: { children: ReactNode }) {
  return (
    <TimeRangeContextProvider initFrom="now-6h" initTo="now" timeZone="utc">
      {children}
    </TimeRangeContextProvider>
  );
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
    const { result } = renderHook(
      () => useVizPanel({ vizConfig, data: panelData(LoadingState.Loading) }),
      { wrapper: TimeRangeWrapper },
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('is true before any data has arrived', () => {
    const { result } = renderHook(
      () => useVizPanel({ vizConfig, data: undefined }),
      { wrapper: TimeRangeWrapper },
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('is false once the query is done', () => {
    const { result } = renderHook(
      () => useVizPanel({ vizConfig, data: panelData(LoadingState.Done) }),
      { wrapper: TimeRangeWrapper },
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('switches from true to false when the query finishes', () => {
    const { result, rerender } = renderHook(
      ({ data }: { data?: PanelData }) => useVizPanel({ vizConfig, data }),
      {
        wrapper: TimeRangeWrapper,
        initialProps: { data: panelData(LoadingState.Loading) },
      },
    );

    expect(result.current.isLoading).toBe(true);

    rerender({ data: panelData(LoadingState.Done) });

    expect(result.current.isLoading).toBe(false);
  });

  it('is true while the plugin is importing, even with finished data', () => {
    mockPlugin(undefined);

    const { result } = renderHook(
      () => useVizPanel({ vizConfig, data: panelData(LoadingState.Done) }),
      { wrapper: TimeRangeWrapper },
    );

    expect(result.current.isLoading).toBe(true);
  });
});

describe('useVizPanel onFieldConfigChange', () => {
  // No plugin, so the hook returns the field config without plugin defaults
  beforeEach(() => {
    mockPlugin(undefined);
  });

  function makeVizConfig(unit: string): VizConfig {
    return {
      ...vizConfig,
      fieldConfig: { defaults: { unit }, overrides: [] },
    } as VizConfig;
  }

  it('merges a change into the current field config', () => {
    const config = makeVizConfig('short');
    const { result } = renderHook(() => useVizPanel({ vizConfig: config }), {
      wrapper: TimeRangeWrapper,
    });

    act(() => {
      result.current.onFieldConfigChange({
        defaults: { decimals: 2 },
        overrides: [],
      });
    });

    expect(result.current.fieldConfig.defaults).toEqual({
      unit: 'short',
      decimals: 2,
    });
  });

  it('replaces the field config when replace is true', () => {
    const config = makeVizConfig('short');
    const { result } = renderHook(() => useVizPanel({ vizConfig: config }), {
      wrapper: TimeRangeWrapper,
    });

    act(() => {
      result.current.onFieldConfigChange(
        { defaults: { decimals: 2 }, overrides: [] },
        true,
      );
    });

    expect(result.current.fieldConfig.defaults).toEqual({ decimals: 2 });
  });

  it('keeps the change across re-renders with the same vizConfig', () => {
    const config = makeVizConfig('short');
    const { result, rerender } = renderHook(
      ({ vizConfig }: { vizConfig: VizConfig }) => useVizPanel({ vizConfig }),
      { wrapper: TimeRangeWrapper, initialProps: { vizConfig: config } },
    );

    act(() => {
      result.current.onFieldConfigChange(
        { defaults: { unit: 'bytes' }, overrides: [] },
        true,
      );
    });
    rerender({ vizConfig: config });

    expect(result.current.fieldConfig.defaults.unit).toBe('bytes');
  });

  it('discards the change when a new vizConfig arrives', () => {
    const { result, rerender } = renderHook(
      ({ vizConfig }: { vizConfig: VizConfig }) => useVizPanel({ vizConfig }),
      {
        wrapper: TimeRangeWrapper,
        initialProps: { vizConfig: makeVizConfig('short') },
      },
    );

    act(() => {
      result.current.onFieldConfigChange(
        { defaults: { unit: 'bytes' }, overrides: [] },
        true,
      );
    });
    rerender({ vizConfig: makeVizConfig('percent') });

    expect(result.current.fieldConfig.defaults.unit).toBe('percent');
  });
});

describe('useVizPanel title and description', () => {
  beforeEach(() => {
    mockPlugin(new PanelPlugin(() => null));
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <TimeRangeWrapper>
        <DefineVariable name="env" value={{ value: 'prod', label: 'Prod' }}>
          {children}
        </DefineVariable>
      </TimeRangeWrapper>
    );
  }

  it('interpolates variables in the title', () => {
    const { result } = renderHook(
      () => useVizPanel({ vizConfig, title: 'Requests in $env' }),
      { wrapper },
    );

    expect(result.current.title).toBe('Requests in prod');
  });

  it('renders the description as markdown with variables interpolated', () => {
    const { result } = renderHook(
      () => useVizPanel({ vizConfig, description: '**Env** is ${env}' }),
      { wrapper },
    );

    expect(result.current.getDescription?.()).toBe(
      '<p><strong>Env</strong> is prod</p>\n',
    );
  });

  it('interpolates variables in field config data links', () => {
    // Grafana registers the standard field options on boot. Without them the
    // plugin defaults would strip the links from the field config.
    standardFieldConfigEditorRegistry.register({
      id: 'links',
      path: 'links',
      name: 'Data links',
      process: (value: unknown) => value,
      shouldApply: () => true,
    } as unknown as FieldConfigPropertyItem);
    mockPlugin(new PanelPlugin(() => null).useFieldConfig());

    const config = {
      ...vizConfig,
      fieldConfig: {
        defaults: { links: [{ title: 'Logs in $env', url: '' }] },
        overrides: [],
      },
    } as VizConfig;
    const data: PanelData = {
      ...panelData(LoadingState.Done),
      series: [
        toDataFrame({
          fields: [{ name: 'A', type: FieldType.number, values: [1] }],
        }),
      ],
    };

    const { result } = renderHook(
      () => useVizPanel({ vizConfig: config, data }),
      { wrapper },
    );

    const [field] = result.current.panelData.series[0].fields;
    const [link] = field.getLinks?.({ valueRowIndex: 0 }) ?? [];
    expect(link?.title).toBe('Logs in prod');
  });

  it('returns no description getter when no description is set', () => {
    const { result } = renderHook(() => useVizPanel({ vizConfig }), {
      wrapper: TimeRangeWrapper,
    });

    expect(result.current.getDescription).toBeUndefined();
  });
});
