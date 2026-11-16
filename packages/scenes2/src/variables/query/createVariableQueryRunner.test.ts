import { lastValueFrom, of } from 'rxjs';
import {
  type DataQueryRequest,
  type DataSourceApi,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  toDataFrame,
  VariableSupportType,
} from '@grafana/data';

import {
  createVariableQueryRunner,
  fetchMetricFindValues,
} from './createVariableQueryRunner';

vi.mock('@grafana/runtime', () => ({
  getRunRequest: vi.fn(),
}));

const request = {
  targets: [],
  range: getDefaultTimeRange(),
} as unknown as DataQueryRequest;

function datasource(overrides: object) {
  return { type: 'fake', ...overrides } as unknown as DataSourceApi;
}

const panelData: PanelData = {
  state: LoadingState.Done,
  series: [
    toDataFrame({
      fields: [{ name: 'text', type: FieldType.string, values: ['A', 'B'] }],
    }),
  ],
  timeRange: getDefaultTimeRange(),
};

describe('createVariableQueryRunner', () => {
  describe('standard variable support', () => {
    const variables = {
      getType: () => VariableSupportType.Standard,
      toDataQuery: (q: object) => ({ ...q, refId: 'converted' }),
      query: vi.fn(),
    };

    it('Should convert a string query to a data query with a default refId', () => {
      const toDataQuery = vi.fn((q: object) => ({ ...q }));
      const runner = createVariableQueryRunner(
        datasource({ variables: { ...variables, toDataQuery } }),
        vi.fn(),
      );

      runner.getTarget({ name: 'metric', query: 'label_values(job)' });

      expect(toDataQuery).toHaveBeenCalledWith({
        query: 'label_values(job)',
        refId: 'variable-metric',
      });
    });

    it('Should add a missing refId and keep an existing one', () => {
      const toDataQuery = vi.fn((q: object) => ({ ...q }));
      const runner = createVariableQueryRunner(
        datasource({ variables: { ...variables, toDataQuery } }),
        vi.fn(),
      );

      runner.getTarget({ name: 'metric', query: { query: 'a' } as never });
      runner.getTarget({
        name: 'metric',
        query: { query: 'b', refId: 'mine' } as never,
      });

      expect(toDataQuery).toHaveBeenNthCalledWith(1, {
        query: 'a',
        refId: 'variable-metric',
      });
      expect(toDataQuery).toHaveBeenNthCalledWith(2, {
        query: 'b',
        refId: 'mine',
      });
    });

    it('Should run the request with the data source variable query', () => {
      const ds = datasource({ variables });
      const runRequest = vi.fn().mockReturnValue(of(panelData));
      const runner = createVariableQueryRunner(ds, runRequest);

      runner.runRequest({ name: 'v', query: 'q' }, request);

      expect(runRequest).toHaveBeenCalledWith(
        ds,
        request,
        expect.any(Function),
      );
    });
  });

  describe('legacy variable support', () => {
    it('Should use the query as target and call metricFindQuery', async () => {
      const metricFindQuery = vi.fn().mockResolvedValue([{ text: 'A' }]);
      const runner = createVariableQueryRunner(
        datasource({ metricFindQuery }),
        vi.fn(),
      );
      const args = { name: 'v', query: 'A.*', searchFilter: 'x' };

      expect(runner.getTarget(args)).toBe('A.*');

      const data = await lastValueFrom(runner.runRequest(args, request));

      expect(metricFindQuery).toHaveBeenCalledWith(
        'A.*',
        expect.objectContaining({
          variable: { name: 'v', type: 'query' },
          searchFilter: 'x',
        }),
      );
      expect(data.series).toEqual([{ text: 'A' }]);
    });

    it('Should return an empty result when metricFindQuery returns no values', async () => {
      const runner = createVariableQueryRunner(
        datasource({ metricFindQuery: vi.fn().mockResolvedValue([]) }),
        vi.fn(),
      );

      const data = await lastValueFrom(
        runner.runRequest({ name: 'v', query: 'A.*' }, request),
      );

      expect(data.series).toEqual([]);
      expect(data.state).toBe(LoadingState.Done);
    });
  });

  describe('custom variable support', () => {
    it('Should use the query as target and run the request with the custom query', () => {
      const ds = datasource({
        variables: {
          getType: () => VariableSupportType.Custom,
          editor: () => null,
          query: vi.fn(),
        },
      });
      const runRequest = vi.fn().mockReturnValue(of(panelData));
      const runner = createVariableQueryRunner(ds, runRequest);
      const query = { refId: 'A', foo: 'bar' };

      expect(runner.getTarget({ name: 'v', query })).toBe(query);

      runner.runRequest({ name: 'v', query }, request);

      expect(runRequest).toHaveBeenCalledWith(
        ds,
        request,
        expect.any(Function),
      );
    });
  });

  describe('data source variable support', () => {
    const ds = datasource({
      variables: { getType: () => VariableSupportType.Datasource },
    });

    it('Should keep a string query as is', () => {
      const runner = createVariableQueryRunner(ds, vi.fn());

      expect(runner.getTarget({ name: 'v', query: 'abc' })).toBe('abc');
    });

    it('Should add a default refId to an object query', () => {
      const runner = createVariableQueryRunner(ds, vi.fn());

      expect(
        runner.getTarget({ name: 'v', query: { refId: undefined as never } }),
      ).toEqual({
        refId: 'variable-query',
      });
      expect(runner.getTarget({ name: 'v', query: { refId: 'B' } })).toEqual({
        refId: 'B',
      });
    });

    it('Should run the request without a custom query function', () => {
      const runRequest = vi.fn().mockReturnValue(of(panelData));
      const runner = createVariableQueryRunner(ds, runRequest);

      runner.runRequest({ name: 'v', query: 'abc' }, request);

      expect(runRequest).toHaveBeenCalledWith(ds, request);
    });
  });

  it('Should throw when the data source has no variable support', () => {
    expect(() =>
      createVariableQueryRunner(datasource({ type: 'plain' }), vi.fn()),
    ).toThrow("Couldn't create a query runner for datasource plain");
  });
});

describe('fetchMetricFindValues', () => {
  const args = { name: 'v', query: 'q' };

  it('Should resolve with the values of the first finished response', async () => {
    const runner = {
      getTarget: () => 'q',
      runRequest: () =>
        of({ ...panelData, state: LoadingState.Loading }, panelData, {
          ...panelData,
          series: [],
        }),
    };

    const values = await fetchMetricFindValues(runner, args, request);

    expect(values.map((v) => v.value)).toEqual(['A', 'B']);
  });

  it('Should reject with the error of a response in error state', async () => {
    const runner = {
      getTarget: () => 'q',
      runRequest: () =>
        of<PanelData>({
          ...panelData,
          state: LoadingState.Error,
          error: { message: 'boom' },
        }),
    };

    await expect(fetchMetricFindValues(runner, args, request)).rejects.toThrow(
      'boom',
    );
  });

  it('Should reject with a generic error when no error details are provided', async () => {
    const runner = {
      getTarget: () => 'q',
      runRequest: () =>
        of<PanelData>({ ...panelData, state: LoadingState.Error }),
    };

    await expect(fetchMetricFindValues(runner, args, request)).rejects.toThrow(
      'Variable query failed',
    );
  });
});
