import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { DataSourceGetTagValuesOptions } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { useAdhocFilters } from '../hooks/useAdhocFilters';
import { TimeRangeContextProvider } from '../time/TimeRangeContext';
import { AdHocFiltersCombobox } from './AdHocFiltersCombobox';
import { AdhocFiltersProvider } from './AdhocFiltersContext';
import type { AdHocFilterWithLabels } from './filterModel';

// The real modules pull browser-only code (uplot and friends) into jsdom.
vi.mock('@grafana/runtime', () => ({
  config: { bootData: { user: { timezone: 'browser' } } },
  getDataSourceSrv: vi.fn(),
}));

vi.mock('@grafana/ui', () => ({
  useStyles2: () => new Proxy({}, { get: () => '' }),
  styleMixins: { getFocusStyles: () => ({}) },
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  IconButton: ({
    tooltip,
    'aria-label': ariaLabel,
    onClick,
  }: {
    tooltip?: string;
    'aria-label'?: string;
    onClick?: (event: React.MouseEvent) => void;
  }) => (
    <button type="button" aria-label={ariaLabel ?? tooltip} onClick={onClick} />
  ),
  Checkbox: ({ checked }: { checked?: boolean }) => (
    <input type="checkbox" checked={checked} readOnly tabIndex={-1} />
  ),
  Spinner: () => <span data-testid="spinner" />,
}));

const TAG_VALUES: Record<string, string[]> = {
  service: ['checkout', 'cart', 'auth'],
  env: ['prod', 'staging', 'dev'],
};

const datasource = {
  getTagKeys: vi.fn(async () =>
    Object.keys(TAG_VALUES).map((key) => ({ text: key })),
  ),
  getTagValues: vi.fn(async ({ key }: DataSourceGetTagValuesOptions) =>
    (TAG_VALUES[key] ?? []).map((value) => ({ text: value })),
  ),
};

function FiltersProbe() {
  const { filters } = useAdhocFilters();
  return <pre data-testid="filters">{JSON.stringify(filters)}</pre>;
}

function readFilters(): AdHocFilterWithLabels[] {
  return JSON.parse(screen.getByTestId('filters').textContent ?? '[]');
}

/** Compact `key op value` form of the committed filters. */
function readFilterSummary(): string[] {
  return readFilters().map(
    (f) => `${f.key} ${f.operator} ${f.values?.join('|') ?? f.value}`,
  );
}

function renderCombobox(initialFilters?: AdHocFilterWithLabels[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <TimeRangeContextProvider>
        <AdhocFiltersProvider
          datasource={{ uid: 'fake' }}
          initialFilters={initialFilters}
        >
          <AdHocFiltersCombobox />
          <FiltersProbe />
        </AdhocFiltersProvider>
      </TimeRangeContextProvider>
    </QueryClientProvider>,
  );

  return userEvent.setup();
}

function addInput() {
  return screen.getByPlaceholderText('+ label = value');
}

async function expectOptions(labels: string[]) {
  await waitFor(() =>
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(labels),
  );
}

function activeOption() {
  return screen
    .getAllByRole('option')
    .find((option) => option.getAttribute('aria-selected') === 'true')
    ?.textContent;
}

describe('AdHocFiltersCombobox', () => {
  // jsdom measures every element as 0px, so the virtual list would render no
  // rows. Give elements a size so the dropdown fits all of them.
  beforeAll(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.mocked(getDataSourceSrv).mockReturnValue({
      get: async () => datasource,
    } as unknown as ReturnType<typeof getDataSourceSrv>);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('adding a filter', () => {
    it('opens the operators and then the values as each step is picked', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await expectOptions(['service', 'env']);

      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toBe('env');
      await user.keyboard('{Enter}');

      await expectOptions([
        '=Equals',
        '!=Not equal',
        '=|One of. Use to filter on multiple values.',
        '!=|Not one of. Use to exclude multiple values.',
        '=~Matches regex',
        '!~Does not match regex',
      ]);

      await user.keyboard('{ArrowDown}{Enter}');
      await expectOptions(['prod', 'staging', 'dev']);

      await user.keyboard('{ArrowDown}{Enter}');

      expect(readFilterSummary()).toEqual(['env != staging']);
      // Ready for the next filter.
      await expectOptions(['service', 'env']);
      expect(screen.getByRole('combobox')).toHaveFocus();
    });

    it('wraps around with the arrow keys', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await expectOptions(['service', 'env']);

      await user.keyboard('{ArrowUp}');
      expect(activeOption()).toBe('env');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toBe('service');
    });

    it('filters options by the typed text', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await user.keyboard('en');

      await expectOptions(['env', 'Use custom value: en']);
    });

    it('picks options with the mouse', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await user.click(await screen.findByRole('option', { name: 'service' }));
      await user.click(await screen.findByRole('option', { name: /Equals/ }));
      await user.click(await screen.findByRole('option', { name: 'cart' }));

      expect(readFilterSummary()).toEqual(['service = cart']);
    });

    it('uses a typed value that the data source did not return', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await user.keyboard('{Enter}');
      await user.keyboard('{Enter}');
      await expectOptions(['checkout', 'cart', 'auth']);

      await user.keyboard('payments');
      await expectOptions(['Use custom value: payments']);
      await user.keyboard('{Enter}');

      expect(readFilterSummary()).toEqual(['service = payments']);
    });

    it('discards a half-built filter on Escape', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await expectOptions(['service', 'env']);
      await user.keyboard('{Enter}');
      await screen.findByRole('option', { name: /Equals/ });

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.queryByText('service')).not.toBeInTheDocument();
      expect(readFilters()).toEqual([]);
    });
  });

  describe('multi-value operators', () => {
    async function pickOneOf(user: ReturnType<typeof userEvent.setup>) {
      await user.click(addInput());
      await expectOptions(['service', 'env']);
      await user.keyboard('{ArrowDown}{Enter}');
      await screen.findByRole('option', { name: /Equals/ });
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
      await expectOptions(['prod', 'staging', 'dev']);
    }

    it('checks several values and commits them on Tab', async () => {
      const user = renderCombobox();
      await pickOneOf(user);

      await user.keyboard('{Enter}{ArrowDown}{ArrowDown}{Enter}');

      const checked = screen
        .getAllByRole('checkbox')
        .map((box) => (box as HTMLInputElement).checked);
      expect(checked).toEqual([true, false, true]);
      expect(readFilters()).toEqual([]);

      await user.keyboard('{Tab}');

      expect(readFilters()).toEqual([
        {
          key: 'env',
          keyLabel: 'env',
          operator: '=|',
          value: 'prod',
          values: ['prod', 'dev'],
          valueLabels: ['prod', 'dev'],
        },
      ]);
    });

    it('commits with the Apply button', async () => {
      const user = renderCombobox();
      await pickOneOf(user);

      await user.click(screen.getByRole('option', { name: 'staging' }));
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      expect(readFilterSummary()).toEqual(['env =| staging']);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('removes picked values with Backspace and with their remove button', async () => {
      const user = renderCombobox();
      await pickOneOf(user);

      await user.keyboard('{Enter}{ArrowDown}{Enter}{ArrowDown}{Enter}');
      await user.keyboard('{Backspace}');
      await user.click(
        screen.getByRole('button', { name: 'Remove filter value - prod' }),
      );
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      expect(readFilterSummary()).toEqual(['env =| staging']);
    });
  });

  describe('typed expressions', () => {
    it('adds a whole filter typed as text', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await user.keyboard('env = prod');

      expect(
        await screen.findByText('Press Enter to apply: env = prod'),
      ).toBeInTheDocument();
      expect(screen.queryAllByRole('option')).toEqual([]);

      await user.keyboard('{Enter}');

      expect(readFilterSummary()).toEqual(['env = prod']);
    });

    it('splits comma-separated values for multi-value operators', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await user.keyboard('env !=| prod, dev{Enter}');

      expect(readFilterSummary()).toEqual(['env !=| prod|dev']);
    });

    it('moves on to the values when only a key and operator are typed', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await user.keyboard('service !={Enter}');

      await expectOptions(['checkout', 'cart', 'auth']);
      await user.keyboard('{Enter}');

      expect(readFilterSummary()).toEqual(['service != checkout']);
    });

    it('takes an operator and value while picking the operator', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await expectOptions(['service', 'env']);
      await user.keyboard('{Enter}');
      await screen.findByRole('option', { name: /Equals/ });

      await user.keyboard('=~ ch.*{Enter}');

      expect(readFilterSummary()).toEqual(['service =~ ch.*']);
    });

    it('adds the filter on Tab', async () => {
      const user = renderCombobox();

      await user.click(addInput());
      await user.keyboard('env = dev{Tab}');

      expect(readFilterSummary()).toEqual(['env = dev']);
    });
  });

  describe('editing a filter', () => {
    const initialFilters: AdHocFilterWithLabels[] = [
      { key: 'service', operator: '=', value: 'checkout' },
      { key: 'env', operator: '=|', value: 'prod', values: ['prod', 'dev'] },
    ];

    it('pre-fills the value when the pill is clicked', async () => {
      const user = renderCombobox(initialFilters);

      await user.click(
        screen.getByRole('button', { name: 'Edit filter with key service' }),
      );

      const input = screen.getByRole('combobox', { name: 'Filter value' });
      expect(input).toHaveValue('checkout');
      expect(input).toHaveFocus();
      // Every option stays listed until the user types.
      await expectOptions(['checkout', 'cart', 'auth']);

      await user.keyboard('car{Enter}');

      expect(readFilterSummary()).toEqual([
        'service = cart',
        'env =| prod|dev',
      ]);
      expect(
        screen.getByRole('button', { name: 'Edit filter with key service' }),
      ).toHaveFocus();
    });

    it('treats typed text as a value, not an expression, in a clicked pill', async () => {
      const user = renderCombobox(initialFilters);

      await user.click(
        screen.getByRole('button', { name: 'Edit filter with key service' }),
      );
      await user.clear(screen.getByRole('combobox', { name: 'Filter value' }));
      await user.keyboard('a=b');

      await expectOptions(['Use custom value: a=b']);
    });

    it('changes the operator from the operator segment', async () => {
      const user = renderCombobox(initialFilters);

      await user.click(
        screen.getByRole('button', { name: 'Edit filter with key service' }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Edit filter operator' }),
      );
      await user.click(
        await screen.findByRole('option', { name: /Not equal/ }),
      );
      await expectOptions(['checkout', 'cart', 'auth']);
      await user.keyboard('{Enter}');

      expect(readFilterSummary()[0]).toBe('service != checkout');
    });

    it('steps from the empty add input back into the last filter', async () => {
      const user = renderCombobox(initialFilters);

      await user.click(addInput());
      await user.keyboard('{Backspace}');

      // The last filter is now an editor, showing its values as removable pills.
      expect(
        await screen.findByRole('button', {
          name: 'Remove filter value - dev',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: 'Filter value' }),
      ).toHaveFocus();

      await user.keyboard('{Backspace}{Escape}');

      expect(readFilterSummary()).toEqual([
        'service = checkout',
        'env =| prod',
      ]);
    });

    it('removes the filter when Backspace clears every part', async () => {
      const user = renderCombobox(initialFilters);

      await user.click(
        screen.getByRole('button', { name: 'Edit filter with key env' }),
      );
      // Values, then operator, then key, then the filter itself.
      await user.keyboard(
        '{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}',
      );

      expect(readFilterSummary()).toEqual(['service = checkout']);
      expect(addInput()).toHaveFocus();
    });

    it('saves the edit on an outside click', async () => {
      const user = renderCombobox(initialFilters);

      await user.click(
        screen.getByRole('button', { name: 'Edit filter with key env' }),
      );
      await user.click(await screen.findByRole('option', { name: 'staging' }));
      await user.click(document.body);

      expect(readFilterSummary()).toEqual([
        'service = checkout',
        'env =| prod|dev|staging',
      ]);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('removes a filter with its remove button', async () => {
      const user = renderCombobox(initialFilters);

      await user.click(
        screen.getByRole('button', { name: 'Remove filter with key service' }),
      );

      expect(readFilterSummary()).toEqual(['env =| prod|dev']);
    });

    it('clears every filter', async () => {
      const user = renderCombobox(initialFilters);

      await user.click(screen.getByRole('button', { name: 'Clear all' }));

      expect(readFilters()).toEqual([]);
    });
  });

  describe('requests', () => {
    it('leaves the filter being picked out of the values request', async () => {
      const user = renderCombobox([
        { key: 'service', operator: '=', value: 'checkout' },
        { key: 'env', operator: '=', value: 'prod' },
      ]);

      await user.click(
        screen.getByRole('button', { name: 'Edit filter with key env' }),
      );
      await expectOptions(['prod', 'staging', 'dev']);

      expect(datasource.getTagValues).toHaveBeenLastCalledWith(
        expect.objectContaining({
          key: 'env',
          filters: [{ key: 'service', operator: '=', value: 'checkout' }],
        }),
      );
    });

    it('offers a retry when the request fails', async () => {
      datasource.getTagKeys.mockRejectedValueOnce(new Error('boom'));
      const user = renderCombobox();

      await user.click(addInput());
      const retry = await screen.findByText(
        'An error has occurred fetching labels. Click to retry',
      );
      await user.click(retry);

      await expectOptions(['service', 'env']);
    });
  });
});
