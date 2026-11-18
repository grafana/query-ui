import { act, renderHook } from '@testing-library/react';
import {
  createTheme,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  PanelPlugin,
  toDataFrame,
} from '@grafana/data';
import { getPluginImportUtils } from '@grafana/runtime';
import { SeriesVisibilityChangeMode } from '@grafana/ui';

import type { VizConfig } from './PanelBuilders/types';
import { usePanelContextState } from './usePanelContextState';
import { useVizPanel } from './useVizPanel';

vi.mock('@grafana/runtime', () => ({
  config: { theme2: createTheme() },
  getAppEvents: () => undefined,
  getPluginImportUtils: vi.fn(),
}));

// The real module imports uPlot's CSS, which jsdom can't load
vi.mock('@grafana/ui', () => ({
  SeriesVisibilityChangeMode: {
    ToggleSelection: 'select',
    AppendToSelection: 'append',
    SetExactly: 'setExactly',
  },
}));

const vizConfig = {
  pluginId: 'timeseries',
  options: {},
  fieldConfig: { defaults: {}, overrides: [] },
} as unknown as VizConfig;

const data: PanelData = {
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'A', type: FieldType.number, values: [1, 2] },
        { name: 'B', type: FieldType.number, values: [3, 4] },
      ],
    }),
  ],
};

function renderPanel() {
  return renderHook(() => {
    const panel = useVizPanel({ vizConfig, data });
    const context = usePanelContextState({
      fieldConfig: panel.fieldConfig,
      options: panel.panelOptions,
      frames: panel.panelData.series,
      onFieldConfigChange: panel.onFieldConfigChange,
      onOptionsChange: panel.onOptionsChange,
    });
    return { panel, context };
  });
}

describe('usePanelContextState', () => {
  beforeEach(() => {
    vi.mocked(getPluginImportUtils).mockReturnValue({
      getPanelPluginFromCache: () => new PanelPlugin(() => null),
      importPanelPlugin: () => new Promise(() => {}),
    } as unknown as ReturnType<typeof getPluginImportUtils>);
  });

  it('hides the other series when one is selected', () => {
    const { result } = renderPanel();

    act(() => {
      result.current.context.onToggleSeriesVisibility?.(
        'A',
        SeriesVisibilityChangeMode.ToggleSelection,
      );
    });

    const [override] = result.current.panel.fieldConfig.overrides;
    expect(override.matcher.options).toMatchObject({
      mode: 'exclude',
      names: ['A'],
    });
  });

  it('shows all series again when the selected one is toggled twice', () => {
    const { result } = renderPanel();

    for (let i = 0; i < 2; i++) {
      act(() => {
        result.current.context.onToggleSeriesVisibility?.(
          'A',
          SeriesVisibilityChangeMode.ToggleSelection,
        );
      });
    }

    expect(result.current.panel.fieldConfig.overrides).toEqual([]);
  });

  it('adds a fixed color override for a series', () => {
    // Called directly: the bare test plugin registers no standard field
    // options, so plugin defaults would strip the color property.
    const onFieldConfigChange = vi.fn();
    const { result } = renderHook(() =>
      usePanelContextState({
        fieldConfig: { defaults: {}, overrides: [] },
        options: {},
        frames: data.series,
        onFieldConfigChange,
        onOptionsChange: vi.fn(),
      }),
    );

    result.current.onSeriesColorChange?.('B', 'red');

    expect(onFieldConfigChange).toHaveBeenCalledWith({
      defaults: {},
      overrides: [
        {
          matcher: { id: 'byName', options: 'B' },
          properties: [
            { id: 'color', value: { mode: 'fixed', fixedColor: 'red' } },
          ],
        },
      ],
    });
  });
});
