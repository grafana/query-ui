import { act, screen, render } from '@testing-library/react';
import { useContext } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

import { UrlStateProvider } from '../url/UrlStateContext';
import { DefineVariable } from './DefineVariable';
import { useInterpolator } from './interpolation/useInterpolator';
import { VariableTestQuery } from './testquery/VariableTestQuery';
import { VariableContext } from './types';

describe('TestVariable', () => {
  it('Simple static variable', () => {
    render(
      <DefineVariable name="test" value={{ value: 'foo', label: 'Foo' }}>
        <EvalExpression id="expr" expr="${test}" />
      </DefineVariable>,
    );

    expect(screen.getByTestId(`expr`)).toHaveTextContent('foo');
  });

  it('Variable with dynamic options', () => {
    render(
      <DefineVariable name="test" value={{ value: 'foo', label: 'Foo' }}>
        <VariableTestQuery name="test" query="A.*" delay={10} />
        <EvalExpression id="expr" expr="${test}" />
      </DefineVariable>,
    );

    expect(screen.getByTestId(`expr`)).toHaveTextContent('foo');
  });
});

describe('DefineVariable url sync', () => {
  function renderWithUrl(entry: string, skipUrlSync?: boolean) {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <UrlStateProvider>
          <DefineVariable
            name="test"
            value={{ value: 'foo', label: 'Foo' }}
            skipUrlSync={skipUrlSync}
          >
            <EvalExpression id="expr" expr="${test}" />
            <Controls />
          </DefineVariable>
          <Location />
        </UrlStateProvider>
      </MemoryRouter>,
    );
  }

  it('Starts from the value in the url', () => {
    renderWithUrl('/?var-test=bar');

    expect(screen.getByTestId('expr')).toHaveTextContent('bar');
  });

  it('Writes changes to the url', () => {
    renderWithUrl('/');

    expect(screen.getByTestId('expr')).toHaveTextContent('foo');

    act(() => screen.getByText('set baz').click());

    expect(screen.getByTestId('expr')).toHaveTextContent('baz');
    expect(screen.getByTestId('search')).toHaveTextContent('?var-test=baz');
  });

  it('Follows a change to the url made from outside', () => {
    renderWithUrl('/?var-test=bar');

    act(() => screen.getByText('go qux').click());
    expect(screen.getByTestId('expr')).toHaveTextContent('qux');

    act(() => screen.getByText('go none').click());
    expect(screen.getByTestId('expr')).toHaveTextContent('foo');
  });

  it('Leaves the url alone with skipUrlSync', () => {
    renderWithUrl('/?var-test=bar', true);

    expect(screen.getByTestId('expr')).toHaveTextContent('foo');

    act(() => screen.getByText('set baz').click());

    expect(screen.getByTestId('expr')).toHaveTextContent('baz');
    expect(screen.getByTestId('search')).toHaveTextContent('?var-test=bar');
  });
});

function Controls() {
  const variable = useContext(VariableContext);
  const navigate = useNavigate();

  return (
    <>
      <button
        onClick={() => variable?.onChange({ value: 'baz', label: 'baz' })}
      >
        set baz
      </button>
      <button onClick={() => navigate({ search: '?var-test=qux' })}>
        go qux
      </button>
      <button onClick={() => navigate({ search: '' })}>go none</button>
    </>
  );
}

function Location() {
  return <div data-testid="search">{useLocation().search}</div>;
}

export function EvalExpression({ id, expr }: { id: string; expr: string }) {
  return <div data-testid={id}>{useInterpolator(expr)}</div>;
}
