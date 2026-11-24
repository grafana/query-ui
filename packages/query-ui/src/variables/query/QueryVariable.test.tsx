import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { MetricFindValue } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { CacheProvider } from '../../caching/CacheContext';
import { useVariable } from '../../hooks/useVariable';
import { TimeRangeContextProvider } from '../../time/TimeRangeContext';
import { DefineVariable } from '../DefineVariable';
import type {
  VariableValue,
  VariableValueOption,
  VariableValueOrValues,
} from '../types';
import { QueryVariable, type QueryVariableProps } from './QueryVariable';

// The real module drags @grafana/ui into jsdom
vi.mock('@grafana/runtime', () => ({
  config: { bootData: { user: { timezone: 'browser' } } },
  getRunRequest: vi.fn(),
  getDataSourceSrv: vi.fn(),
}));

const VALUES: Record<string, string[]> = {
  service: ['api', 'web', 'db'],
  pod: ['api-1', 'api-2', 'web-1'],
  tier: ['web', 'db'],
};

/** Legacy data source: the query names a label, the search filter narrows its values. */
const metricFindQuery = vi.fn(
  async (
    query: string,
    options?: { searchFilter?: string },
  ): Promise<MetricFindValue[]> =>
    (VALUES[query] ?? [])
      .filter((value) => value.includes(options?.searchFilter ?? ''))
      .map((text) => ({ text })),
);

const web = { value: 'web', label: 'web' };

let loadOptions:
  ((search: string) => Promise<VariableValueOption[]>) | undefined;

function Probe({ name }: { name: string }) {
  const variable = useVariable<VariableValueOrValues>(name);
  React.useEffect(() => {
    loadOptions = variable.loadOptions;
  });

  return (
    <>
      <div data-testid="loading">{String(Boolean(variable.loading))}</div>
      <div data-testid="value">{String(variable.getValue())}</div>
    </>
  );
}

function renderVariable(
  props: Partial<QueryVariableProps>,
  wrap: (node: React.ReactNode) => React.ReactNode = (node) => node,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TimeRangeContextProvider>
        <CacheProvider>
          {wrap(
            <QueryVariable
              name="test"
              datasource={{ uid: 'legacy' }}
              query="service"
              {...props}
            >
              <Probe name="test" />
            </QueryVariable>,
          )}
        </CacheProvider>
      </TimeRangeContextProvider>
    </QueryClientProvider>,
  );
}

describe('QueryVariable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadOptions = undefined;

    vi.mocked(getDataSourceSrv).mockReturnValue({
      get: async () => ({ name: 'legacy', type: 'legacy', metricFindQuery }),
    } as unknown as ReturnType<typeof getDataSourceSrv>);
  });

  describe('When there is no value', () => {
    it('Should run the query on mount and select the first option', async () => {
      renderVariable({});

      expect(screen.getByTestId('loading')).toHaveTextContent('true');
      await waitFor(() =>
        expect(screen.getByTestId('value')).toHaveTextContent('api'),
      );
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('Should interpolate variables in the query', async () => {
      renderVariable({ query: '${label}' }, (node) => (
        <DefineVariable name="label" value={{ value: 'pod', label: 'pod' }}>
          {node}
        </DefineVariable>
      ));

      await waitFor(() =>
        expect(screen.getByTestId('value')).toHaveTextContent('api-1'),
      );
      expect(metricFindQuery).toHaveBeenCalledWith('pod', expect.anything());
    });
  });

  describe('When there is a value', () => {
    it('Should not run the query until options are loaded', async () => {
      renderVariable({ value: web });

      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('value')).toHaveTextContent('web');
      expect(metricFindQuery).not.toHaveBeenCalled();
    });
  });

  describe('When options are loaded on demand', () => {
    it('Should send the search as the search filter', async () => {
      renderVariable({ value: web });

      const options = await act(() => loadOptions!('b'));

      expect(options.map((o) => o.value)).toEqual(['web', 'db']);
      expect(metricFindQuery).toHaveBeenCalledWith(
        'service',
        expect.objectContaining({ searchFilter: 'b' }),
      );
    });

    it('Should apply the regex and static options', async () => {
      renderVariable({
        value: web,
        regex: '^(api|web)$',
        staticOptions: [{ value: 'all', label: 'All' }],
      });

      const options = await act(() => loadOptions!(''));

      expect(options.map((o) => o.value)).toEqual(['all', 'api', 'web']);
    });

    it('Should reuse the options the mount query loaded', async () => {
      renderVariable({});
      await waitFor(() =>
        expect(screen.getByTestId('value')).toHaveTextContent('api'),
      );

      await act(() => loadOptions!(''));

      expect(metricFindQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('When a variable the query references changes', () => {
    function PickLabel({ label }: { label: string }) {
      const variable = useVariable<VariableValue>('label');

      return (
        <button onClick={() => variable.onChange({ value: label, label })}>
          {label}
        </button>
      );
    }

    function renderChained(value: VariableValueOrValues) {
      return renderVariable({ query: '${label}', value }, (node) => (
        <DefineVariable
          name="label"
          value={{ value: 'service', label: 'service' }}
        >
          <PickLabel label="tier" />
          <PickLabel label="pod" />
          {node}
        </DefineVariable>
      ));
    }

    it('Should keep the value when it is still one of the options', async () => {
      renderChained(web);

      await act(async () => screen.getByText('tier').click());

      await waitFor(() => expect(metricFindQuery).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(screen.getByTestId('loading')).toHaveTextContent('false'),
      );
      expect(metricFindQuery).toHaveBeenCalledWith('tier', expect.anything());
      expect(screen.getByTestId('value')).toHaveTextContent('web');
    });

    it('Should select the first option when the value is no longer one of the options', async () => {
      renderChained(web);

      await act(async () => screen.getByText('pod').click());

      await waitFor(() =>
        expect(screen.getByTestId('value')).toHaveTextContent('api-1'),
      );
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('Should not run the query again while the references stay the same', async () => {
      renderChained(web);

      await act(async () => screen.getByText('pod').click());
      await waitFor(() =>
        expect(screen.getByTestId('value')).toHaveTextContent('api-1'),
      );

      expect(metricFindQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('When the variable is multi-value', () => {
    function PickLabel({ label }: { label: string }) {
      const variable = useVariable<VariableValue>('label');

      return (
        <button onClick={() => variable.onChange({ value: label, label })}>
          {label}
        </button>
      );
    }

    function renderChained(value: VariableValue[]) {
      return renderVariable({ query: '${label}', value }, (node) => (
        <DefineVariable
          name="label"
          value={{ value: 'service', label: 'service' }}
        >
          <PickLabel label="tier" />
          <PickLabel label="pod" />
          {node}
        </DefineVariable>
      ));
    }

    const db = { value: 'db', label: 'db' };
    const api = { value: 'api', label: 'api' };

    it('Should select the first option as a list when there is no value', async () => {
      renderVariable({ value: [] });

      await waitFor(() =>
        expect(screen.getByTestId('value')).toHaveTextContent('api'),
      );
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('Should not run the query on mount when there are values', async () => {
      renderVariable({ value: [web, db] });

      expect(screen.getByTestId('value')).toHaveTextContent('web,db');
      expect(metricFindQuery).not.toHaveBeenCalled();
    });

    it('Should keep the values that are still options', async () => {
      renderChained([api, web, db]);

      await act(async () => screen.getByText('tier').click());

      await waitFor(() =>
        expect(screen.getByTestId('value')).toHaveTextContent('web,db'),
      );
      expect(screen.getByTestId('value')).toHaveTextContent(/^web,db$/);
    });

    it('Should select the first option when none of the values are options', async () => {
      renderChained([web, db]);

      await act(async () => screen.getByText('pod').click());

      await waitFor(() =>
        expect(screen.getByTestId('value')).toHaveTextContent(/^api-1$/),
      );
    });
  });
});
