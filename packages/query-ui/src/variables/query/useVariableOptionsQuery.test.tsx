import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { of } from 'rxjs';
import {
  type DataSourceApi,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  toDataFrame,
  VariableSort,
  VariableSupportType,
} from '@grafana/data';
import { getDataSourceSrv, getRunRequest } from '@grafana/runtime';

import { TimeRangeContextProvider } from '../../time/TimeRangeContext';
import {
  useVariableOptionsQuery,
  type VariableOptionsQueryProps,
} from './useVariableOptionsQuery';

const runRequestMock = vi.fn();
const getDataSourceMock = vi.fn();

// The real module drags @grafana/ui into jsdom
vi.mock('@grafana/runtime', () => ({
  config: { bootData: { user: { timezone: 'browser' } } },
  getRunRequest: vi.fn(),
  getDataSourceSrv: vi.fn(),
}));

function createMockData(valueValues: string[], textValues?: string[]) {
  const fields = textValues
    ? [
        { name: 'text', type: FieldType.string, values: textValues },
        { name: 'value', type: FieldType.string, values: valueValues },
      ]
    : [{ name: 'text', type: FieldType.string, values: valueValues }];

  return of<PanelData>({
    state: LoadingState.Done,
    series: [toDataFrame({ fields })],
    timeRange: getDefaultTimeRange(),
  });
}

const standardDatasource = {
  name: 'fake-std',
  type: 'fake-std',
  uid: 'fake-std',
  variables: {
    getType: () => VariableSupportType.Standard,
    toDataQuery: (q: object) => ({ ...q, refId: 'FakeDataSource-refId' }),
  },
} as unknown as DataSourceApi;

const defaultProps: VariableOptionsQueryProps = {
  datasource: { uid: 'fake-std' },
  query: 'query',
};

function renderOptionsQuery(initialProps: VariableOptionsQueryProps) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TimeRangeContextProvider>{children}</TimeRangeContextProvider>
    </QueryClientProvider>
  );

  return renderHook((props) => useVariableOptionsQuery(props), {
    wrapper,
    initialProps,
  });
}

describe('useVariableOptionsQuery', () => {
  beforeEach(() => {
    runRequestMock.mockReturnValue(createMockData(['val1', 'val2', 'val11']));
    getDataSourceMock.mockImplementation(() =>
      Promise.resolve(standardDatasource),
    );

    vi.mocked(getRunRequest).mockReturnValue(runRequestMock);
    vi.mocked(getDataSourceSrv).mockReturnValue({
      get: getDataSourceMock,
    } as unknown as ReturnType<typeof getDataSourceSrv>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('When the query is resolved', () => {
    it('Should resolve variable options via the data source variable support', async () => {
      const { result } = renderOptionsQuery(defaultProps);

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([
        { label: 'val1', value: 'val1', properties: { text: 'val1' } },
        { label: 'val2', value: 'val2', properties: { text: 'val2' } },
        { label: 'val11', value: 'val11', properties: { text: 'val11' } },
      ]);
    });

    it('Should look up the data source and issue the query as a data query', async () => {
      const { result } = renderOptionsQuery({
        ...defaultProps,
        name: 'metrics',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getDataSourceMock).toHaveBeenCalledWith({ uid: 'fake-std' });

      const [datasource, request] = runRequestMock.mock.calls[0];
      expect(datasource).toBe(standardDatasource);
      expect(request.targets).toEqual([
        { query: 'query', refId: 'FakeDataSource-refId' },
      ]);
      expect(request.range).toBeDefined();
      expect(request.scopedVars).toEqual({});
    });

    it('Should provide object values when properties are received', async () => {
      runRequestMock.mockReturnValue(
        of<PanelData>({
          state: LoadingState.Done,
          series: [
            toDataFrame({
              fields: [
                {
                  name: 'value',
                  type: FieldType.string,
                  values: ['test', 'prod'],
                },
                {
                  name: 'text',
                  type: FieldType.string,
                  values: ['Test', 'Prod'],
                },
                {
                  name: 'location',
                  type: FieldType.string,
                  values: ['US', 'EU'],
                },
              ],
            }),
          ],
          timeRange: getDefaultTimeRange(),
        }),
      );

      const { result } = renderOptionsQuery(defaultProps);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([
        {
          label: 'Test',
          value: 'test',
          properties: { value: 'test', text: 'Test', location: 'US' },
        },
        {
          label: 'Prod',
          value: 'prod',
          properties: { value: 'prod', text: 'Prod', location: 'EU' },
        },
      ]);
    });
  });

  describe('When the query is empty or disabled', () => {
    it('Should return no options and not issue a request when the query is empty', async () => {
      const { result } = renderOptionsQuery({ ...defaultProps, query: '' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
      expect(runRequestMock).not.toHaveBeenCalled();
    });

    it('Should not issue a request until enabled', async () => {
      const { result, rerender } = renderOptionsQuery({
        ...defaultProps,
        enabled: false,
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(getDataSourceMock).not.toHaveBeenCalled();
      expect(runRequestMock).not.toHaveBeenCalled();

      rerender({ ...defaultProps, enabled: true });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(runRequestMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('When the query fails', () => {
    it('Should surface query errors reported only via data.errors', async () => {
      runRequestMock.mockReturnValue(
        of<PanelData>({
          state: LoadingState.Error,
          series: [],
          error: undefined,
          errors: [
            {
              message:
                'error querying the database: 001003 (42000): SQL compilation error',
            },
          ],
          timeRange: getDefaultTimeRange(),
        }),
      );

      const { result } = renderOptionsQuery(defaultProps);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(
        'error querying the database: 001003 (42000): SQL compilation error',
      );
      expect(result.current.data).toBeUndefined();
    });

    it('Should fail when the data source has no variable support', async () => {
      getDataSourceMock.mockResolvedValue({
        name: 'plain',
        type: 'plain',
      } as unknown as DataSourceApi);

      const { result } = renderOptionsQuery(defaultProps);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe(
        "Couldn't create a query runner for datasource plain",
      );
    });
  });

  describe('When a legacy data source is used', () => {
    it('Should call metricFindQuery with the variable name and search filter', async () => {
      const metricFindQuery = vi
        .fn()
        .mockResolvedValue([{ text: 'A' }, { text: 'B' }]);
      getDataSourceMock.mockResolvedValue({
        name: 'legacy',
        type: 'legacy',
        metricFindQuery,
      } as unknown as DataSourceApi);

      const { result } = renderOptionsQuery({
        datasource: { uid: 'legacy' },
        query: 'A.$__searchFilter',
        name: 'server',
        searchFilter: 'foo',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(metricFindQuery).toHaveBeenCalledWith(
        'A.$__searchFilter',
        expect.objectContaining({
          variable: { name: 'server', type: 'query' },
          searchFilter: 'foo',
        }),
      );
      expect(result.current.data).toEqual([
        { label: 'A', value: 'A', properties: undefined },
        { label: 'B', value: 'B', properties: undefined },
      ]);
    });
  });

  describe('When regex is provided', () => {
    it('Should return options that match the regex', async () => {
      const { result } = renderOptionsQuery({
        ...defaultProps,
        regex: '/^val1/',
        regexApplyTo: 'value',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([
        { label: 'val1', value: 'val1', properties: { text: 'val1' } },
        { label: 'val11', value: 'val11', properties: { text: 'val11' } },
      ]);
    });

    it('Should apply the regex to text if regexApplyTo is set to text', async () => {
      runRequestMock.mockReturnValue(
        createMockData(
          ['val1', 'val2', 'val11'],
          ['Display1', 'Display2', 'Display11'],
        ),
      );

      const { result } = renderOptionsQuery({
        ...defaultProps,
        regex: '/^Display1/',
        regexApplyTo: 'text',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([
        {
          label: 'Display1',
          value: 'val1',
          properties: { text: 'Display1', value: 'val1' },
        },
        {
          label: 'Display11',
          value: 'val11',
          properties: { text: 'Display11', value: 'val11' },
        },
      ]);
    });

    it('Should default regexApplyTo to value', async () => {
      runRequestMock.mockReturnValue(
        createMockData(
          ['val1', 'val2', 'val11'],
          ['Display1', 'Display2', 'Display11'],
        ),
      );

      const { result } = renderOptionsQuery({
        ...defaultProps,
        regex: '/^val2/',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([
        {
          label: 'Display2',
          value: 'val2',
          properties: { text: 'Display2', value: 'val2' },
        },
      ]);
    });

    it('Should reapply the regex without issuing a new request', async () => {
      const { result, rerender } = renderOptionsQuery(defaultProps);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(3);

      rerender({ ...defaultProps, regex: '/^val2/' });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(runRequestMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('When sort is provided', () => {
    it.each([
      [VariableSort.naturalDesc, ['val11', 'val2', 'val1']],
      [VariableSort.naturalAsc, ['val1', 'val2', 'val11']],
      [VariableSort.alphabeticalAsc, ['val1', 'val11', 'val2']],
    ])('Should sort options with sort order %s', async (sort, expected) => {
      const { result } = renderOptionsQuery({ ...defaultProps, sort });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.map((o) => o.value)).toEqual(expected);
    });
  });

  describe('When a search filter is provided', () => {
    it('Should pass it to the data source as the __searchFilter variable', async () => {
      const { result } = renderOptionsQuery({
        ...defaultProps,
        query: 'A.$__searchFilter',
        searchFilter: 'muu!',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(runRequestMock.mock.calls[0][1].scopedVars.__searchFilter).toEqual(
        { value: 'muu!', text: 'muu!' },
      );
    });

    it('Should issue a new query when the search filter changes', async () => {
      const { result, rerender } = renderOptionsQuery({
        ...defaultProps,
        query: 'A.$__searchFilter',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(runRequestMock).toHaveBeenCalledTimes(1);

      rerender({
        ...defaultProps,
        query: 'A.$__searchFilter',
        searchFilter: 'muu!',
      });

      await waitFor(() => expect(runRequestMock).toHaveBeenCalledTimes(2));
      expect(
        runRequestMock.mock.calls[1][1].scopedVars.__searchFilter.value,
      ).toBe('muu!');
    });
  });

  describe('When static options are provided', () => {
    const staticOptions = [
      { label: 'A', value: 'A' },
      { label: 'B', value: 'B' },
      { label: 'C', value: 'C' },
    ];

    const queryOptions = [
      { label: 'val1', value: 'val1', properties: { text: 'val1' } },
      { label: 'val2', value: 'val2', properties: { text: 'val2' } },
      { label: 'val11', value: 'val11', properties: { text: 'val11' } },
    ];

    it('Should prepend static options when no order is provided', async () => {
      const { result } = renderOptionsQuery({ ...defaultProps, staticOptions });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([...staticOptions, ...queryOptions]);
    });

    it('Should prepend static options when order "before" is provided', async () => {
      const { result } = renderOptionsQuery({
        ...defaultProps,
        staticOptions,
        staticOptionsOrder: 'before',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([...staticOptions, ...queryOptions]);
    });

    it('Should append static options when order "after" is provided', async () => {
      const { result } = renderOptionsQuery({
        ...defaultProps,
        staticOptions,
        staticOptionsOrder: 'after',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([...queryOptions, ...staticOptions]);
    });

    it('Should sort static options and query results when order "sorted" is provided', async () => {
      const { result } = renderOptionsQuery({
        ...defaultProps,
        sort: VariableSort.alphabeticalAsc,
        staticOptions: [
          { label: 'A', value: 'A' },
          { label: 'B', value: 'B' },
          { label: 'val12', value: 'val12' },
        ],
        staticOptionsOrder: 'sorted',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([
        { label: 'A', value: 'A' },
        { label: 'B', value: 'B' },
        { label: 'val1', value: 'val1', properties: { text: 'val1' } },
        { label: 'val11', value: 'val11', properties: { text: 'val11' } },
        { label: 'val12', value: 'val12' },
        { label: 'val2', value: 'val2', properties: { text: 'val2' } },
      ]);
    });

    it('Should deduplicate options with the same value, preferring the static option', async () => {
      const { result } = renderOptionsQuery({
        ...defaultProps,
        staticOptions: [
          { label: 'A', value: 'A' },
          { label: 'val3', value: 'val11' },
        ],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([
        { label: 'A', value: 'A' },
        { label: 'val3', value: 'val11' },
        { label: 'val1', value: 'val1', properties: { text: 'val1' } },
        { label: 'val2', value: 'val2', properties: { text: 'val2' } },
      ]);
    });
  });
});
