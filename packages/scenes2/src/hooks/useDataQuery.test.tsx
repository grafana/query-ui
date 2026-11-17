import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { Subject } from 'rxjs';
import {
  type DataQuery,
  type DataSourceApi,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  toDataFrame,
} from '@grafana/data';
import { getDataSourceSrv, getRunRequest } from '@grafana/runtime';

import { TimeRangeContextProvider } from '../time/TimeRangeContext';
import { type DataQueryOptions, useDataQuery } from './useDataQuery';
import { useTimeRange } from './useTimeRange';

// The real module drags @grafana/ui into jsdom
vi.mock('@grafana/runtime', () => ({
  config: { bootData: { user: { timezone: 'browser' } } },
  getRunRequest: vi.fn(),
  getDataSourceSrv: vi.fn(),
}));

const datasource = { uid: 'test-ds', interval: '1m' } as DataSourceApi;

const options: DataQueryOptions<DataQuery> = {
  queries: [{ refId: 'A', datasource: { uid: 'test-ds' } }],
};

/** One pending request per runRequest call, resolved by the test. */
let requests: Array<Subject<PanelData>> = [];

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
  });
  request.complete();
}

function seriesValue(data: PanelData | undefined) {
  return data?.series[0]?.fields[0]?.values[0];
}

function renderDataQuery() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TimeRangeContextProvider>{children}</TimeRangeContextProvider>
    </QueryClientProvider>
  );

  return renderHook(
    () => ({ query: useDataQuery(options), timeRange: useTimeRange() }),
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
    vi.mocked(getRunRequest).mockReturnValue(() => {
      const request = new Subject<PanelData>();
      requests.push(request);
      return request.asObservable();
    });
    vi.mocked(getDataSourceSrv).mockReturnValue({
      get: () => Promise.resolve(datasource),
    } as unknown as ReturnType<typeof getDataSourceSrv>);
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
});
