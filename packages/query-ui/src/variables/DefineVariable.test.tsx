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

describe('DefineVariable options', () => {
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  it('Starts from the options it is given', () => {
    render(
      <DefineVariable name="test" value={{ value: 'a' }} options={options}>
        <PrintOptions />
      </DefineVariable>,
    );

    expect(screen.getByTestId('options')).toHaveTextContent('a:A,b:B');
  });

  it('Labels a value from the url with the matching option', () => {
    render(
      <MemoryRouter initialEntries={['/?var-test=b']}>
        <UrlStateProvider>
          <DefineVariable name="test" value={{ value: 'a' }} options={options}>
            <EvalExpression id="text" expr="${test:text}" />
          </DefineVariable>
        </UrlStateProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('text')).toHaveTextContent('B');
  });
});

function PrintOptions() {
  const variable = useContext(VariableContext);
  const text = (variable?.options ?? [])
    .map((o) => `${o.value}:${o.label}`)
    .join(',');

  return <div data-testid="options">{text}</div>;
}

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

describe('DefineVariable multi value', () => {
  function renderMulti(entry: string) {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <UrlStateProvider>
          <DefineVariable
            name="test"
            value={[
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
            ]}
          >
            <EvalExpression id="expr" expr="${test}" />
            <EvalExpression id="csv" expr="${test:csv}" />
            <EvalExpression id="text" expr="${test:text}" />
            <MultiControls />
          </DefineVariable>
          <Location />
        </UrlStateProvider>
      </MemoryRouter>,
    );
  }

  it('Interpolates every value', () => {
    renderMulti('/');

    expect(screen.getByTestId('expr')).toHaveTextContent('{a,b}');
    expect(screen.getByTestId('csv')).toHaveTextContent('a,b');
    expect(screen.getByTestId('text')).toHaveTextContent('A + B');
  });

  it('Starts from the values in the url', () => {
    renderMulti('/?var-test=x&var-test=y');

    expect(screen.getByTestId('csv')).toHaveTextContent('x,y');
  });

  it('Reads a single parameter as a list of one', () => {
    renderMulti('/?var-test=x');

    expect(screen.getByTestId('csv')).toHaveTextContent('x');
  });

  it('Writes one parameter per value to the url', () => {
    renderMulti('/');

    act(() => screen.getByText('set c d').click());

    expect(screen.getByTestId('csv')).toHaveTextContent('c,d');
    expect(screen.getByTestId('search')).toHaveTextContent(
      '?var-test=c&var-test=d',
    );

    act(() => screen.getByText('set none').click());

    expect(screen.getByTestId('csv')).toHaveTextContent('');
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('Follows a change to the url made from outside', () => {
    renderMulti('/?var-test=x');

    act(() => screen.getByText('go y z').click());
    expect(screen.getByTestId('csv')).toHaveTextContent('y,z');

    act(() => screen.getByText('go none').click());
    expect(screen.getByTestId('csv')).toHaveTextContent('a,b');
  });
});

function MultiControls() {
  const variable = useContext(VariableContext);
  const navigate = useNavigate();

  return (
    <>
      <button
        onClick={() =>
          variable?.onChange([
            { value: 'c', label: 'C' },
            { value: 'd', label: 'D' },
          ])
        }
      >
        set c d
      </button>
      <button onClick={() => variable?.onChange([])}>set none</button>
      <button onClick={() => navigate({ search: '?var-test=y&var-test=z' })}>
        go y z
      </button>
      <button onClick={() => navigate({ search: '' })}>go none</button>
    </>
  );
}

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
