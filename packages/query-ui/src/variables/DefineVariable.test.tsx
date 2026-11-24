import { render, screen, waitFor } from '@testing-library/react';

import { DefineVariable } from './DefineVariable';
import { useInterpolator } from './interpolation/useInterpolator';
import { VariableTestQuery } from './testquery/VariableTestQuery';

// The state behind the variable, with url sync and options, is tested in useVariableContextState.test.ts

describe('DefineVariable', () => {
  it('Should interpolate a static value', () => {
    render(
      <DefineVariable name="test" value={{ value: 'foo', label: 'Foo' }}>
        <EvalExpression id="expr" expr="${test}" />
      </DefineVariable>,
    );

    expect(screen.getByTestId(`expr`)).toHaveTextContent('foo');
  });

  it('Should check the value against options loaded later', async () => {
    render(
      <DefineVariable name="test" value={{ value: 'foo', label: 'Foo' }}>
        <VariableTestQuery name="test" query="A.*" delay={10} />
        <EvalExpression id="expr" expr="${test}" />
      </DefineVariable>,
    );

    expect(screen.getByTestId(`expr`)).toHaveTextContent('foo');
    await waitFor(() =>
      expect(screen.getByTestId('expr')).toHaveTextContent('AA'),
    );
  });

  it('Should interpolate every value of a list', () => {
    render(
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
      </DefineVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('{a,b}');
    expect(screen.getByTestId('csv')).toHaveTextContent('a,b');
    expect(screen.getByTestId('text')).toHaveTextContent('A + B');
  });
});

function EvalExpression({ id, expr }: { id: string; expr: string }) {
  return <div data-testid={id}>{useInterpolator(expr)}</div>;
}
