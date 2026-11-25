import { act, render, screen, waitFor } from '@testing-library/react';
import { PluginType } from '@grafana/data';
import {
  getDataSourceInstanceList,
  getDefaultDataSourceInstanceListItem,
} from '@grafana/plugin-compat/datasources';

import { CacheProvider } from '../caching/CacheContext';
import { MemoryCache } from '../caching/MemoryCache';
import { useVariable } from '../hooks/useVariable';
import { DataSourceVariable } from './DataSourceVariable';
import { DefineVariable } from './DefineVariable';
import type { VariableValue } from './types';

vi.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstanceList: vi.fn(),
  getDefaultDataSourceInstanceListItem: vi.fn(),
}));

type DataSourceInstanceListItem = Awaited<
  ReturnType<typeof getDataSourceInstanceList>
>[number];

const getDataSourceInstanceListMock = vi.mocked(getDataSourceInstanceList);
const getDefaultDataSourceInstanceListItemMock = vi.mocked(
  getDefaultDataSourceInstanceListItem,
);

function getDataSource(
  overrides: Partial<DataSourceInstanceListItem>,
): DataSourceInstanceListItem {
  return {
    uid: '1',
    type: 'prometheus',
    name: 'name',
    meta: {
      id: 'prometheus',
      name: 'name',
      type: PluginType.datasource,
      info: {
        author: { name: 'Grafana Labs' },
        description: 'Grafana Data Source',
        logos: {
          small: 'public/img/icn-datasource.svg',
          large: 'public/img/icn-datasource.svg',
        },
        links: [{ name: 'project', url: 'one link' }],
        screenshots: [{ path: `screenshot`, name: 'test' }],
        updated: '2018-09-26',
        version: '1',
      },
      module: 'path/to/module',
      baseUrl: 'path/to/plugin',
    },
    ...overrides,
  } as DataSourceInstanceListItem;
}

const prometheus = getDataSource({
  name: 'prometheus-mocked',
  type: 'prometheus',
  uid: 'prometheus-mocked-uid',
});
const slowPrometheus = getDataSource({
  name: 'slow-prometheus-mocked',
  type: 'prometheus',
  uid: 'slow-prometheus-mocked-uid',
});
const elastic = getDataSource({
  name: 'elastic-mocked',
  type: 'elastic',
  uid: 'elastic-mocked-uid',
});

interface ProbeState {
  value: VariableValue;
  options: unknown;
  loading: boolean | undefined;
  error: string | undefined;
}

/**
 * Renders the variable state as JSON so tests can read it back with `getProbe()`.
 */
function Probe({ name }: { name: string }) {
  const variable = useVariable<VariableValue>(name);
  const state: ProbeState = {
    value: variable.value,
    options: variable.options,
    loading: variable.loading,
    error: variable.error?.message,
  };

  return (
    <>
      <div data-testid="loading">{String(Boolean(variable.loading))}</div>
      <pre data-testid="probe">{JSON.stringify(state)}</pre>
    </>
  );
}

function getProbe(): ProbeState {
  return JSON.parse(screen.getByTestId('probe').textContent ?? '{}');
}

async function renderVariable(
  props: Partial<React.ComponentProps<typeof DataSourceVariable>>,
) {
  render(
    <CacheProvider>
      <DataSourceVariable name="test" pluginId="" {...props}>
        <Probe name="test" />
      </DataSourceVariable>
    </CacheProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId('loading')).toHaveTextContent('false'),
  );

  return getProbe();
}

describe('DataSourceVariable', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getDataSourceInstanceListMock.mockImplementation(async (filters) => {
      if (filters?.pluginId === 'prometheus') {
        return [prometheus, slowPrometheus];
      }

      if (filters?.pluginId === 'elastic') {
        return [elastic];
      }

      return [];
    });

    getDefaultDataSourceInstanceListItemMock.mockImplementation(async (items) =>
      items.find((item) => item.uid === slowPrometheus.uid),
    );
  });

  describe('When empty plugin id is provided', () => {
    it('Should default to undefined options and undefined value', async () => {
      const state = await renderVariable({ pluginId: '' });

      expect(state.value).toEqual({ value: undefined, label: undefined });
      expect(state.options).toEqual([]);
      expect(getDataSourceInstanceListMock).not.toHaveBeenCalled();
    });
  });

  describe('When plugin id is provided', () => {
    it('Should set error when no data sources are found', async () => {
      const state = await renderVariable({
        pluginId: 'non-existent-datasource',
      });

      expect(state.value).toEqual({ value: undefined, label: undefined });
      expect(state.error).toEqual('No data sources found');
    });

    it('Should add default option when defaultOptionEnabled is true', async () => {
      const state = await renderVariable({
        pluginId: 'prometheus',
        defaultOptionEnabled: true,
      });

      expect(state.value).toEqual({
        value: 'prometheus-mocked-uid',
        label: 'prometheus-mocked',
      });
      expect(state.options).toEqual([
        { label: 'prometheus-mocked', value: 'prometheus-mocked-uid' },
        {
          label: 'slow-prometheus-mocked',
          value: 'slow-prometheus-mocked-uid',
        },
        { label: 'default', value: 'default' },
      ]);
    });

    it('Should include only data sources of the given plugin id', async () => {
      const state = await renderVariable({ pluginId: 'prometheus' });

      expect(state.value).toEqual({
        value: 'prometheus-mocked-uid',
        label: 'prometheus-mocked',
      });
      expect(state.options).toEqual([
        { label: 'prometheus-mocked', value: 'prometheus-mocked-uid' },
        {
          label: 'slow-prometheus-mocked',
          value: 'slow-prometheus-mocked-uid',
        },
      ]);
    });
  });

  describe('When resolving data sources', () => {
    it('Should request only metrics data sources of the plugin id without variables', async () => {
      await renderVariable({ pluginId: 'prometheus' });

      expect(getDataSourceInstanceListMock).toHaveBeenCalledWith({
        metrics: true,
        variables: false,
        pluginId: 'prometheus',
      });
    });

    it('Should not look up the default data source when defaultOptionEnabled is not set', async () => {
      await renderVariable({ pluginId: 'prometheus' });

      expect(getDefaultDataSourceInstanceListItemMock).not.toHaveBeenCalled();
    });

    it('Should add the default option right after the default data source', async () => {
      getDefaultDataSourceInstanceListItemMock.mockResolvedValue(prometheus);

      const state = await renderVariable({
        pluginId: 'prometheus',
        defaultOptionEnabled: true,
      });

      expect(state.options).toEqual([
        { label: 'prometheus-mocked', value: 'prometheus-mocked-uid' },
        { label: 'default', value: 'default' },
        {
          label: 'slow-prometheus-mocked',
          value: 'slow-prometheus-mocked-uid',
        },
      ]);
    });

    it('Should not add the default option when the default data source is not among the plugin id matches', async () => {
      getDefaultDataSourceInstanceListItemMock.mockResolvedValue(undefined);

      const state = await renderVariable({
        pluginId: 'elastic',
        defaultOptionEnabled: true,
      });

      expect(state.options).toEqual([
        { label: 'elastic-mocked', value: 'elastic-mocked-uid' },
      ]);
    });

    it('Should pass the unfiltered list of the plugin id to the default lookup', async () => {
      await renderVariable({
        pluginId: 'prometheus',
        regex: 'prometheus-mocked',
        defaultOptionEnabled: true,
      });

      expect(getDefaultDataSourceInstanceListItemMock).toHaveBeenCalledWith([
        prometheus,
        slowPrometheus,
      ]);
    });

    it('Should surface errors from listing data sources', async () => {
      getDataSourceInstanceListMock.mockRejectedValue(new Error('boom'));

      const state = await renderVariable({ pluginId: 'prometheus' });

      expect(state.error).toEqual('boom');
    });

    it('Should ignore a request that resolves after the plugin id changed', async () => {
      let resolveStale: (
        items: DataSourceInstanceListItem[],
      ) => void = () => {};
      getDataSourceInstanceListMock.mockReturnValueOnce(
        new Promise((resolve) => (resolveStale = resolve)),
      );

      const cache = new MemoryCache();

      function Wrapper({ pluginId }: { pluginId: string }) {
        return (
          <CacheProvider cache={cache}>
            <DataSourceVariable name="test" pluginId={pluginId}>
              <Probe name="test" />
            </DataSourceVariable>
          </CacheProvider>
        );
      }

      const { rerender } = render(<Wrapper pluginId="prometheus" />);
      rerender(<Wrapper pluginId="elastic" />);
      await waitFor(() =>
        expect(getProbe().value.value).toEqual('elastic-mocked-uid'),
      );

      // The stale prometheus request resolves last with no data sources
      await act(async () => {
        resolveStale([]);
        await Promise.resolve();
      });

      expect(getProbe().value).toEqual({
        value: 'elastic-mocked-uid',
        label: 'elastic-mocked',
      });
      expect(getProbe().error).toBeUndefined();
    });

    it('Should clear a previous error once data sources are found', async () => {
      const cache = new MemoryCache();

      function Wrapper({ pluginId }: { pluginId: string }) {
        return (
          <CacheProvider cache={cache}>
            <DataSourceVariable name="test" pluginId={pluginId}>
              <Probe name="test" />
            </DataSourceVariable>
          </CacheProvider>
        );
      }

      const { rerender } = render(<Wrapper pluginId="non-existent" />);
      await waitFor(() =>
        expect(getProbe().error).toEqual('No data sources found'),
      );

      rerender(<Wrapper pluginId="prometheus" />);
      await waitFor(() => expect(getProbe().error).toBeUndefined());
      expect(getProbe().value.value).toEqual('prometheus-mocked-uid');
    });
  });

  describe('When regex is provided', () => {
    it('Should include only data sources with matching names', async () => {
      const state = await renderVariable({
        pluginId: 'prometheus',
        regex: 'slow.*',
      });

      expect(state.value).toEqual({
        value: 'slow-prometheus-mocked-uid',
        label: 'slow-prometheus-mocked',
      });
      expect(state.options).toEqual([
        {
          label: 'slow-prometheus-mocked',
          value: 'slow-prometheus-mocked-uid',
        },
      ]);
    });

    it('Should match the regex against "default" independently of the default data source name', async () => {
      const state = await renderVariable({
        pluginId: 'prometheus',
        regex: '^default$',
        defaultOptionEnabled: true,
      });

      expect(state.options).toEqual([{ label: 'default', value: 'default' }]);
    });

    it('Should not add the default option when the regex does not match "default"', async () => {
      const state = await renderVariable({
        pluginId: 'prometheus',
        regex: 'slow.*',
        defaultOptionEnabled: true,
      });

      expect(state.options).toEqual([
        {
          label: 'slow-prometheus-mocked',
          value: 'slow-prometheus-mocked-uid',
        },
      ]);
    });

    it('Should interpolate variables in the regex', async () => {
      render(
        <CacheProvider>
          <DefineVariable
            name="prefix"
            value={{ value: 'slow', label: 'slow' }}
          >
            <DataSourceVariable
              name="test"
              pluginId="prometheus"
              regex="${prefix}.*"
            >
              <Probe name="test" />
            </DataSourceVariable>
          </DefineVariable>
        </CacheProvider>,
      );

      await waitFor(() =>
        expect(getProbe().value).toEqual({
          value: 'slow-prometheus-mocked-uid',
          label: 'slow-prometheus-mocked',
        }),
      );
      expect(getProbe().options).toEqual([
        {
          label: 'slow-prometheus-mocked',
          value: 'slow-prometheus-mocked-uid',
        },
      ]);
    });
  });

  describe('When value is provided', () => {
    it('Should keep current value if it is valid and resolve its label', async () => {
      const state = await renderVariable({
        pluginId: 'prometheus',
        value: 'slow-prometheus-mocked-uid',
      });

      expect(state.value).toEqual({
        value: 'slow-prometheus-mocked-uid',
        label: 'slow-prometheus-mocked',
      });
    });

    it('Should pick first option if current value is not valid', async () => {
      const state = await renderVariable({
        pluginId: 'elastic',
        value: 'prometheus-mocked-uid',
      });

      expect(state.value).toEqual({
        value: 'elastic-mocked-uid',
        label: 'elastic-mocked',
      });
    });
  });

  describe('When remounted', () => {
    function Selector({
      name,
      uid,
      label,
    }: {
      name: string;
      uid: string;
      label: string;
    }) {
      const variable = useVariable<VariableValue>(name);

      return (
        <button onClick={() => variable.onChange({ value: uid, label })}>
          select
        </button>
      );
    }

    function renderIn(
      cache: MemoryCache,
      props: Partial<React.ComponentProps<typeof DataSourceVariable>> = {},
    ) {
      const name = props.name ?? 'test';

      return render(
        <CacheProvider cache={cache}>
          <DataSourceVariable name="test" pluginId="prometheus" {...props}>
            <Probe name={name} />
            <Selector
              name={name}
              uid="slow-prometheus-mocked-uid"
              label="slow"
            />
          </DataSourceVariable>
        </CacheProvider>,
      );
    }

    async function waitForLoaded() {
      await waitFor(() =>
        expect(screen.getByTestId('loading')).toHaveTextContent('false'),
      );
    }

    it('Should restore the value the user selected', async () => {
      const cache = new MemoryCache();

      const first = renderIn(cache);
      await waitForLoaded();
      expect(getProbe().value.value).toEqual('prometheus-mocked-uid');

      await act(async () => screen.getByText('select').click());
      expect(getProbe().value.value).toEqual('slow-prometheus-mocked-uid');
      first.unmount();

      renderIn(cache);
      // Restored on the first render, before the options have loaded
      expect(getProbe().value.value).toEqual('slow-prometheus-mocked-uid');
      await waitForLoaded();
      expect(getProbe().value).toEqual({
        value: 'slow-prometheus-mocked-uid',
        label: 'slow-prometheus-mocked',
      });
    });

    it('Should prefer the remembered value over the value prop', async () => {
      const cache = new MemoryCache();

      const first = renderIn(cache);
      await waitForLoaded();
      await act(async () => screen.getByText('select').click());
      first.unmount();

      renderIn(cache, { value: 'prometheus-mocked-uid' });
      await waitForLoaded();
      expect(getProbe().value.value).toEqual('slow-prometheus-mocked-uid');
    });

    it('Should fall back to the first option when the remembered value is no longer valid', async () => {
      const cache = new MemoryCache();

      const first = renderIn(cache);
      await waitForLoaded();
      await act(async () => screen.getByText('select').click());
      first.unmount();

      renderIn(cache, { pluginId: 'elastic' });
      await waitForLoaded();
      expect(getProbe().value).toEqual({
        value: 'elastic-mocked-uid',
        label: 'elastic-mocked',
      });
    });

    it('Should keep separate values per variable name', async () => {
      const cache = new MemoryCache();

      const first = renderIn(cache, { name: 'a' });
      await waitForLoaded();
      await act(async () => screen.getByText('select').click());
      first.unmount();

      renderIn(cache, { name: 'b' });
      await waitForLoaded();
      expect(getProbe().value.value).toEqual('prometheus-mocked-uid');
    });

    it('Should not remember an empty value', async () => {
      const cache = new MemoryCache();

      renderIn(cache, { pluginId: 'non-existent-datasource' });
      await waitForLoaded();

      expect(cache.has('test')).toBe(false);
    });
  });
});
