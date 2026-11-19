import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAdhocFilters } from '../hooks/useAdhocFilters';
import { useVariable } from '../hooks/useVariable';
import { DefineVariable } from '../variables/DefineVariable';
import type { VariableValue } from '../variables/types';
import { AdhocFiltersProvider } from './AdhocFiltersContext';
import type { AdHocFilterWithLabels } from './AdhocFiltersContext';
import { AdhocFiltersVariable } from './AdhocFiltersVariable';

function Probe() {
  const { onAddFilter, onUpdateFilter, onRemoveFilter, filters } =
    useAdhocFilters();
  const variable = useVariable<VariableValue>('filters');

  return (
    <div>
      <span data-testid="value">{String(variable.value.value)}</span>
      <button
        onClick={() =>
          onAddFilter({ key: 'env', operator: '=', value: 'prod' })
        }
      >
        add
      </button>
      <button onClick={() => onUpdateFilter(filters[0]!, { value: 'dev' })}>
        update
      </button>
      <button onClick={() => onRemoveFilter(filters[0]!)}>remove</button>
    </div>
  );
}

function renderVariable(initialFilters?: AdHocFilterWithLabels[]) {
  render(
    <AdhocFiltersProvider initialFilters={initialFilters}>
      <AdhocFiltersVariable name="filters">
        <Probe />
      </AdhocFiltersVariable>
    </AdhocFiltersProvider>,
  );
}

describe('AdhocFiltersVariable', () => {
  afterEach(cleanup);

  it('starts with the initial filters rendered as label matchers', () => {
    renderVariable([
      { key: 'job', operator: '=', value: 'api' },
      { key: 'env', operator: '!=', value: 'dev' },
    ]);

    expect(screen.getByTestId('value')).toHaveTextContent(
      'job="api",env!="dev"',
    );
  });

  it('is empty without filters', () => {
    renderVariable();

    expect(screen.getByTestId('value')).toHaveTextContent('');
  });

  it('updates when filters are added, updated and removed', () => {
    renderVariable();

    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('value')).toHaveTextContent('env="prod"');

    fireEvent.click(screen.getByText('update'));
    expect(screen.getByTestId('value')).toHaveTextContent('env="dev"');

    fireEvent.click(screen.getByText('remove'));
    expect(screen.getByTestId('value')).toHaveTextContent('');
  });

  it('reads the parent variable chain', () => {
    function ParentProbe() {
      return <span data-testid="parent">{useVariable('other').name}</span>;
    }

    render(
      <AdhocFiltersProvider>
        <DefineVariable name="other">
          <AdhocFiltersVariable name="filters">
            <ParentProbe />
          </AdhocFiltersVariable>
        </DefineVariable>
      </AdhocFiltersProvider>,
    );

    expect(screen.getByTestId('parent')).toHaveTextContent('other');
  });

  it('throws outside an AdhocFiltersProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <AdhocFiltersVariable name="filters">
          <div />
        </AdhocFiltersVariable>,
      ),
    ).toThrow('AdhocFiltersContext not found');

    spy.mockRestore();
  });
});
