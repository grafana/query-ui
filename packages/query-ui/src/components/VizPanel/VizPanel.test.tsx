import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type * as ReactUse from 'react-use';
import {
  createTheme,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  PanelPlugin,
  type PanelProps,
} from '@grafana/data';
import { getPluginImportUtils } from '@grafana/runtime';

import { TimeRangeContextProvider } from '../../time/TimeRangeContext';
import { DefineVariable } from '../../variables/DefineVariable';
import type { VizConfig } from './PanelBuilders/types';
import { VizPanel } from './VizPanel';

vi.mock('@grafana/runtime', () => ({
  config: { theme2: createTheme() },
  getAppEvents: () => undefined,
  getPluginImportUtils: vi.fn(),
}));

// The real module imports uPlot's CSS, which jsdom can't load
vi.mock('@grafana/ui', () => ({
  PanelChrome: ({
    children,
    width,
    height,
  }: {
    children: (width: number, height: number) => ReactNode;
    width: number;
    height: number;
  }) => <div>{children(width, height)}</div>,
  PanelContextProvider: ({ children }: { children: ReactNode }) => children,
  SeriesVisibilityChangeMode: {
    ToggleSelection: 'select',
    AppendToSelection: 'append',
    SetExactly: 'setExactly',
  },
}));

// jsdom has no layout, so the real hook measures 0x0 and renders no panel
vi.mock('react-use', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactUse>()),
  useMeasure: () => [() => {}, { width: 400, height: 300 }],
}));

const vizConfig = {
  pluginId: 'fake-panel',
  options: {},
  fieldConfig: { defaults: {}, overrides: [] },
} as unknown as VizConfig;

const data: PanelData = {
  state: LoadingState.Done,
  series: [],
  timeRange: getDefaultTimeRange(),
};

// VizPanel requires a time range provider above it
function TimeRangeWrapper({ children }: { children: ReactNode }) {
  return (
    <TimeRangeContextProvider initFrom="now-6h" initTo="now" timeZone="utc">
      {children}
    </TimeRangeContextProvider>
  );
}

function FakePanel({ replaceVariables }: PanelProps) {
  return <div>{replaceVariables('Fake panel in $env')}</div>;
}

describe('VizPanel', () => {
  beforeEach(() => {
    vi.mocked(getPluginImportUtils).mockReturnValue({
      getPanelPluginFromCache: () => new PanelPlugin(FakePanel),
      importPanelPlugin: () => new Promise(() => {}),
    } as unknown as ReturnType<typeof getPluginImportUtils>);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the panel plugin component', () => {
    render(<VizPanel vizConfig={vizConfig} data={data} />, {
      wrapper: TimeRangeWrapper,
    });

    expect(screen.getByText(/^Fake panel in/)).toBeInTheDocument();
  });

  it('interpolates variables through replaceVariables', () => {
    render(
      <DefineVariable name="env" value={{ value: 'prod', label: 'Prod' }}>
        <VizPanel vizConfig={vizConfig} data={data} />
      </DefineVariable>,
      { wrapper: TimeRangeWrapper },
    );

    expect(screen.getByText('Fake panel in prod')).toBeInTheDocument();
  });
});
