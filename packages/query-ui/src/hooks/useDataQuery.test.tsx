import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { Subject } from 'rxjs';
import {
  type DataQueryRequest,
  type DataSourceApi,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  toDataFrame,
} from '@grafana/data';
import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { getRunRequest } from '@grafana/runtime';
import type { DataQuery, TimeZone } from '@grafana/schema';

import type { VizConfig } from '../components/VizPanel/PanelBuilders/types';
import { useVizPanel } from '../components/VizPanel/useVizPanel';
import { TimeRangeContextProvider } from '../time/TimeRangeContext';
import { type DataQueryOptions, useDataQuery } from './useDataQuery';
import { useTimeRange } from './useTimeRange';

// The real module drags @grafana/ui into jsdom
vi.mock('@grafana/runtime', () => ({
  config: { bootData: { user: { timezone: 'browser' } } },
  getRunRequest: vi.fn(),
  // No panel plugin: the tests only need useVizPanel's cancel handler.
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: () => undefined,
    importPanelPlugin: () => new Promise(() => {}),
  }),
}));

vi.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstance: vi.fn(),
}));

const vizConfig = {
  pluginId: 'timeseries',
  options: {},
  fieldConfig: { defaults: {}, overrides: [] },
} as unknown as VizConfig;

const datasource = { uid: 'test-ds', interval: '1m' } as DataSourceApi;

const options: DataQueryOptions<DataQuery> = {
  queries: [{ refId: 'A', datasource: { uid: 'test-ds' } }],
};

/** One pending request per runRequest call, resolved by the test. */
let requests: Array<Subject<PanelData>> = [];
/** The DataQueryRequest of each runRequest call, by index. */
let requestArgs: DataQueryRequest[] = [];

function respond(index: number, value: number) {
  const request = requests[index];
  request.next({
    state: LoadingState.Done,
    series: [
      toDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [value] }],
      }),
    ],
    timeRange: getDefaultTimeRange(),
    request: requestArgs[index],
  });
  request.complete();
}

function seriesValue(data: PanelData | undefined) {
  return data?.series[0]?.fields[0]?.values[0];
}

let queryClient: QueryClient;

function renderDataQuery({ timeZone }: { timeZone?: TimeZone } = {}) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TimeRangeContextProvider timeZone={timeZone}>
        {children}
      </TimeRangeContextProvider>
    </QueryClientProvider>
  );

  return renderHook(
    () => {
      const query = useDataQuery(options);
      const panel = useVizPanel({ vizConfig, data: query.data });
      return { query, panel, timeRange: useTimeRange() };
    },
    { wrapper },
  );
}

describe('useDataQuery', () => {
  beforeEach(() => {
    // Fake only Date, so a refresh evaluates the relative range to a new
    // value (and a new query key) while promises and timers run normally.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));

    requests = [];
    requestArgs = [];
    vi.mocked(getRunRequest).mockReturnValue((_ds, args) => {
      requestArgs.push(args);
      const request = new Subject<PanelData>();
      requests.push(request);
      return request.asObservable();
    });
    vi.mocked(getDataSourceInstance).mockResolvedValue(datasource);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('has no data before the first query resolves', async () => {
    const { result } = renderDataQuery();

    await waitFor(() => expect(requests).toHaveLength(1));

    expect(result.current.query.data).toBeUndefined();
  });

  it('keeps the previous data and reports loading while a refresh runs', async () => {
    const { result } = renderDataQuery();

    await waitFor(() => expect(requests).toHaveLength(1));
    act(() => respond(0, 1));
    await waitFor(() =>
      expect(result.current.query.data?.state).toBe(LoadingState.Done),
    );

    vi.setSystemTime(new Date('2026-01-01T12:01:00Z'));
    act(() => result.current.timeRange.onRefresh());
    await waitFor(() => expect(requests).toHaveLength(2));

    expect(result.current.query.data?.state).toBe(LoadingState.Loading);
    expect(seriesValue(result.current.query.data)).toBe(1);

    act(() => respond(1, 2));
    await waitFor(() =>
      expect(result.current.query.data?.state).toBe(LoadingState.Done),
    );

    expect(seriesValue(result.current.query.data)).toBe(2);
  });

  it('uses the query hash as the request id', async () => {
    renderDataQuery();

    await waitFor(() => expect(requests).toHaveLength(1));

    expect(requestArgs[0].requestId).toMatch(/^\["data",/);
  });

  it('sends the time zone of the time range provider', async () => {
    const { result } = renderDataQuery({ timeZone: 'Europe/Oslo' });

    await waitFor(() => expect(requests).toHaveLength(1));

    expect(result.current.timeRange.timeZone).toBe('Europe/Oslo');
    expect(requestArgs[0].timezone).toBe('Europe/Oslo');
  });

  it('sends the default time zone when the provider has none', async () => {
    const { result } = renderDataQuery();

    await waitFor(() => expect(requests).toHaveLength(1));

    expect(result.current.timeRange.timeZone).toBe('browser');
    expect(requestArgs[0].timezone).toBe('browser');
  });

  it('the panel cancel aborts a refresh and keeps the previous data', async () => {
    const { result } = renderDataQuery();

    await waitFor(() => expect(requests).toHaveLength(1));
    act(() => respond(0, 1));
    await waitFor(() =>
      expect(result.current.query.data?.state).toBe(LoadingState.Done),
    );

    vi.setSystemTime(new Date('2026-01-01T12:02:00Z'));
    act(() => result.current.timeRange.onRefresh());
    await waitFor(() => expect(requests).toHaveLength(2));

    // The previous data stands in, but its request id points at the new query.
    expect(result.current.query.data?.request?.requestId).toBe(
      requestArgs[1].requestId,
    );
    expect(requests[1].observed).toBe(true);

    act(() => result.current.panel.onCancelQuery?.());

    await waitFor(() => expect(result.current.query.isFetching).toBe(false));
    expect(requests[1].observed).toBe(false);
    expect(result.current.query.data?.state).toBe(LoadingState.Done);
    expect(seriesValue(result.current.query.data)).toBe(1);
  });

  it('resolves to an empty result when canceled before any data', async () => {
    const { result } = renderDataQuery();

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(result.current.query.data).toBeUndefined();

    act(() => {
      void queryClient.cancelQueries({ queryKey: ['data'] });
    });

    await waitFor(() =>
      expect(result.current.query.data?.state).toBe(LoadingState.Done),
    );
    expect(requests[0].observed).toBe(false);
    expect(result.current.query.data?.series).toEqual([]);
  });
});
