import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { map, Subject } from 'rxjs';
import {
  type DataFrame,
  type DataSourceApi,
  type DataTransformerConfig,
  type DataTransformerInfo,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { getRunRequest } from '@grafana/runtime';
import type { DataQuery } from '@grafana/schema';

import { CacheProvider } from '../caching/CacheContext';
import { TimeRangeContextProvider } from '../time/TimeRangeContext';
import { useDataQuery } from './useDataQuery';
import {
  type DataTransformation,
  useDataTransformer,
} from './useDataTransformer';
import { useTimeRange } from './useTimeRange';

// The real module drags @grafana/ui into jsdom
vi.mock('@grafana/runtime', () => ({
  config: { bootData: { user: { timezone: 'browser' } } },
  getRunRequest: vi.fn(),
}));

vi.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstance: vi.fn(),
}));

const multiplyTransformer: DataTransformerInfo<{ factor: number }> = {
  id: 'multiply',
  name: 'Multiply',
  operator: (options) => (source) =>
    source.pipe(
      map((frames: DataFrame[]) =>
        frames.map((frame) => ({
          ...frame,
          fields: frame.fields.map((field) => ({
            ...field,
            values: field.values.map((v: number) => v * options.factor),
          })),
        })),
      ),
    ),
};

beforeAll(() => {
  standardTransformersRegistry.setInit(() => [
    {
      id: multiplyTransformer.id,
      name: multiplyTransformer.name,
      description: '',
      transformation: () => Promise.resolve(multiplyTransformer),
      editor: () => null,
      imageDark: '',
      imageLight: '',
    },
  ]);
});

const multiplyBy2: DataTransformerConfig = {
  id: 'multiply',
  options: { factor: 2 },
};

const queries: DataQuery[] = [{ refId: 'A', datasource: { uid: 'test-ds' } }];

/** One pending request per runRequest call, resolved by the test. */
let requests: Array<Subject<PanelData>> = [];

function respond(index: number, value: number) {
  requests[index].next({
    state: LoadingState.Done,
    series: [
      toDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [value] }],
      }),
    ],
    timeRange: getDefaultTimeRange(),
  });
  requests[index].complete();
}

/** What a consumer of the transformer saw on one render. */
interface Render {
  state: LoadingState | undefined;
  value: number | undefined;
}

function toRender(data: PanelData | undefined): Render {
  return { state: data?.state, value: data?.series[0]?.fields[0]?.values[0] };
}

/**
 * Renders useDataQuery piped through useDataTransformer and records what the
 * transformer returned on each render.
 */
function renderQueryWithTransformer(transformations: DataTransformation[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CacheProvider>
      <QueryClientProvider client={queryClient}>
        <TimeRangeContextProvider>{children}</TimeRangeContextProvider>
      </QueryClientProvider>
    </CacheProvider>
  );

  const renders: Render[] = [];

  const hook = renderHook(
    () => {
      const query = useDataQuery({ queries });
      const data = useDataTransformer(transformations, query.data);
      renders.push(toRender(data));
      return { data, timeRange: useTimeRange() };
    },
    { wrapper },
  );

  return { ...hook, renders };
}

/**
 * Runs a first query and a refresh, and returns what the transformer returned
 * on each render, grouped by the step that caused it.
 */
async function runQueryAndRefresh(
  transformations: DataTransformation[],
  expected: { first: number; second: number },
) {
  const { result, renders } = renderQueryWithTransformer(transformations);

  await waitFor(() => expect(requests).toHaveLength(1));
  const mount = renders.splice(0);

  act(() => respond(0, 1));
  await waitFor(() =>
    expect(toRender(result.current.data)).toEqual(done(expected.first)),
  );
  const firstResponse = renders.splice(0);

  vi.setSystemTime(new Date('2026-01-01T12:01:00Z'));
  act(() => result.current.timeRange.onRefresh());
  await waitFor(() => expect(requests).toHaveLength(2));
  const refreshStart = renders.splice(0);

  act(() => respond(1, 2));
  await waitFor(() =>
    expect(toRender(result.current.data)).toEqual(done(expected.second)),
  );
  const refreshResponse = renders.splice(0);

  return { mount, firstResponse, refreshStart, refreshResponse };
}

const noData: Render = { state: undefined, value: undefined };

function done(value: number): Render {
  return { state: LoadingState.Done, value };
}

function loading(value: number): Render {
  return { state: LoadingState.Loading, value };
}

describe('useDataTransformer with useDataQuery', () => {
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
    vi.mocked(getDataSourceInstance).mockResolvedValue({
      uid: 'test-ds',
      interval: '1m',
    } as DataSourceApi);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // The baseline the transformed case below is compared with: without
  // transformations the hook hands the query data through as it is.
  it('adds no renders without transformations', async () => {
    const renders = await runQueryAndRefresh([], { first: 1, second: 2 });

    expect(renders).toEqual({
      mount: [noData, noData],
      firstResponse: [done(1)],
      refreshStart: [loading(1)],
      refreshResponse: [done(2)],
    });
  });

  it('adds one render per query response, and none when a refresh starts', async () => {
    const renders = await runQueryAndRefresh([multiplyBy2], {
      first: 2,
      second: 4,
    });

    expect(renders).toEqual({
      mount: [noData, noData],
      // The query data arrives, then the transformed frames one render later.
      firstResponse: [noData, done(2)],
      // Only the loading state changes, so the frames are not transformed again.
      refreshStart: [loading(2)],
      // The previous frames stay up, loading, until the new ones are transformed.
      refreshResponse: [loading(2), done(4)],
    });
  });
});
