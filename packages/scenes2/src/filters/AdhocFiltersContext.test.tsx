import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { useAdhocFilters } from '../hooks/useAdhocFilters';
import { UrlStateProvider } from '../url/UrlStateContext';
import { AdhocFiltersProvider } from './AdhocFiltersContext';
import type { AdHocFilterWithLabels } from './AdhocFiltersContext';

function FiltersProbe() {
  const { filters, baseFilters, onAddFilter, onUpdateFilter, onRemoveFilter } =
    useAdhocFilters();

  return (
    <div>
      <span data-testid="filters">
        {filters.map((f) => `${f.key}${f.operator}${f.value}`).join(',')}
      </span>
      <span data-testid="base-filters">
        {baseFilters?.map((f) => `${f.key}${f.operator}${f.value}`).join(',')}
      </span>
      <button
        onClick={() =>
          onAddFilter({ key: 'service', operator: '=', value: 'checkout' })
        }
      >
        add
      </button>
      <button
        onClick={() => {
          const target = filters[0];
          if (target) {
            onUpdateFilter(target, { value: 'cart' });
          }
        }}
      >
        update
      </button>
      <button
        onClick={() => {
          const target = filters[0];
          if (target) {
            onRemoveFilter(target);
          }
        }}
      >
        remove
      </button>
    </div>
  );
}

function renderScenario(initialFilters?: AdHocFilterWithLabels[]) {
  return render(
    <AdhocFiltersProvider initialFilters={initialFilters}>
      <FiltersProbe />
    </AdhocFiltersProvider>,
  );
}

function readFilters() {
  return screen.getByTestId('filters').textContent;
}

afterEach(() => {
  cleanup();
});

describe('AdhocFiltersProvider', () => {
  it('starts with no filters by default', () => {
    renderScenario();

    expect(readFilters()).toBe('');
  });

  it('starts with the given initial filters', () => {
    renderScenario([{ key: 'env', operator: '=', value: 'prod' }]);

    expect(readFilters()).toBe('env=prod');
  });

  it('adds a filter', () => {
    renderScenario();

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    expect(readFilters()).toBe('service=checkout');
  });

  it('updates a filter in place', () => {
    renderScenario([{ key: 'service', operator: '=', value: 'checkout' }]);

    fireEvent.click(screen.getByRole('button', { name: 'update' }));

    expect(readFilters()).toBe('service=cart');
  });

  it('removes a filter', () => {
    renderScenario([{ key: 'service', operator: '=', value: 'checkout' }]);

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    expect(readFilters()).toBe('');
  });
});

describe('baseFilters', () => {
  it('exposes base filters without adding them to the user filters', () => {
    render(
      <AdhocFiltersProvider
        baseFilters={[{ key: 'cluster', operator: '=', value: 'a' }]}
      >
        <FiltersProbe />
      </AdhocFiltersProvider>,
    );

    expect(screen.getByTestId('base-filters').textContent).toBe('cluster=a');
    expect(readFilters()).toBe('');
  });
});

describe('useAdhocFilters', () => {
  it('throws without a provider', () => {
    expect(() => render(<FiltersProbe />)).toThrow(
      'AdhocFiltersContext not found',
    );
  });
});

describe('url sync', () => {
  function LocationProbe() {
    const location = useLocation();
    const navigate = useNavigate();

    return (
      <>
        <span data-testid="search">{location.search}</span>
        <button onClick={() => navigate(-1)}>back</button>
      </>
    );
  }

  function renderSynced(entry = '/', initialFilters?: AdHocFilterWithLabels[]) {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <UrlStateProvider>
          <AdhocFiltersProvider initialFilters={initialFilters}>
            <FiltersProbe />
          </AdhocFiltersProvider>
          <LocationProbe />
        </UrlStateProvider>
      </MemoryRouter>,
    );
  }

  function readSearch() {
    return decodeURIComponent(screen.getByTestId('search').textContent ?? '');
  }

  it('mounts on the filters in the URL', () => {
    renderSynced('/?var-filters=env%7C%3D%7Cprod');

    expect(readFilters()).toBe('env=prod');
  });

  it('prefers the filters in the URL over the initial ones', () => {
    renderSynced('/?var-filters=env%7C%3D%7Cprod', [
      { key: 'region', operator: '=', value: 'eu' },
    ]);

    expect(readFilters()).toBe('env=prod');
  });

  it('keeps the initial filters, and the URL clean, without a parameter', () => {
    renderSynced('/', [{ key: 'region', operator: '=', value: 'eu' }]);

    expect(readFilters()).toBe('region=eu');
    expect(readSearch()).toBe('');
  });

  it('writes a change to the URL', () => {
    renderSynced();

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    expect(readSearch()).toBe('?var-filters=service|=|checkout');

    fireEvent.click(screen.getByRole('button', { name: 'update' }));

    expect(readSearch()).toBe('?var-filters=service|=|cart');

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    expect(readSearch()).toBe('');
  });

  it('keeps cleared filters cleared when the initial ones had filters', () => {
    renderSynced('/', [{ key: 'region', operator: '=', value: 'eu' }]);

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    expect(readFilters()).toBe('');
    expect(readSearch()).toBe('?var-filters=');
  });

  it('mounts on no filters when the parameter is empty', () => {
    renderSynced('/?var-filters=', [
      { key: 'region', operator: '=', value: 'eu' },
    ]);

    expect(readFilters()).toBe('');
  });

  it('follows the URL when it changes from outside', () => {
    renderSynced();

    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    expect(readFilters()).toBe('service=checkout');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'back' }));
    });

    expect(readFilters()).toBe('');
  });

  it('keeps the filters in step across changes in the same tick', () => {
    renderSynced();

    act(() => {
      screen.getByRole('button', { name: 'add' }).click();
      screen.getByRole('button', { name: 'add' }).click();
    });

    expect(readFilters()).toBe('service=checkout,service=checkout');
    expect(readSearch()).toBe(
      '?var-filters=service|=|checkout&var-filters=service|=|checkout',
    );
  });

  it('mounts on several filters, one parameter each', () => {
    renderSynced('/?var-filters=env|=|prod&var-filters=region|!=|eu');

    expect(readFilters()).toBe('env=prod,region!=eu');
  });

  it('syncs to the key it is given', () => {
    render(
      <MemoryRouter initialEntries={['/?var-filters=env|=|prod']}>
        <UrlStateProvider>
          <AdhocFiltersProvider urlKey="f">
            <FiltersProbe />
          </AdhocFiltersProvider>
          <LocationProbe />
        </UrlStateProvider>
      </MemoryRouter>,
    );

    // The default key is no business of a provider that asked for another one
    expect(readFilters()).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    expect(readSearch()).toBe('?var-filters=env|=|prod&f=service|=|checkout');
  });

  it('gives a nested provider a numbered key', () => {
    render(
      <MemoryRouter initialEntries={['/?var-filters2=env|=|prod']}>
        <UrlStateProvider>
          <AdhocFiltersProvider>
            <AdhocFiltersProvider>
              <FiltersProbe />
            </AdhocFiltersProvider>
          </AdhocFiltersProvider>
          <LocationProbe />
        </UrlStateProvider>
      </MemoryRouter>,
    );

    expect(readFilters()).toBe('env=prod');

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    expect(readSearch()).toBe(
      '?var-filters2=env|=|prod&var-filters2=service|=|checkout',
    );
  });

  it('keeps the filters to itself without a UrlStateProvider', () => {
    renderScenario();

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    expect(readFilters()).toBe('service=checkout');
  });
});
