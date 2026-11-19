import { render, screen } from '@testing-library/react';
import React, { useContext } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VariableFormatID } from '@grafana/schema';

import { DefineVariable } from '../DefineVariable';
import { ObjectVariable } from '../ObjectVariable';
import {
  type InterpolationFormatParameter,
  VariableContext,
  type VariableContextState,
} from '../types';
import { useInterpolator } from './useInterpolator';

describe('useInterpolator', () => {
  it('uses the closest variable', () => {
    render(
      <DefineVariable name="test" value={{ value: 'hello' }}>
        <DefineVariable name="atRootOnly" value={{ value: 'RootValue' }}>
          <Interpolate id="root" expr="${test}" />
          <DefineVariable name="test" value={{ value: 'nestedValue' }}>
            <Interpolate id="nested" expr="${test}" />
            <Interpolate id="rootOnly" expr="${atRootOnly}" />
          </DefineVariable>
        </DefineVariable>
      </DefineVariable>,
    );

    expect(screen.getByTestId('root')).toHaveTextContent('hello');
    expect(screen.getByTestId('nested')).toHaveTextContent('nestedValue');
    expect(screen.getByTestId('rootOnly')).toHaveTextContent('RootValue');
  });

  it('interpolates an expression with a field path', () => {
    render(
      <ObjectVariable name="test" value={{ prop1: 'prop1Value' }}>
        <Interpolate id="expr" expr="${test.prop1}" />
      </ObjectVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('prop1Value');
  });

  it('can use a format', () => {
    render(
      <DefineVariable name="test" value={{ value: 'hello' }}>
        <Interpolate id="expr" expr="${test:queryparam}" />
      </DefineVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('var-test=hello');
  });

  it('formats the label with the text format', () => {
    render(
      <DefineVariable name="test" value={{ value: '1', label: 'One' }}>
        <Interpolate id="expr" expr="${test:text}" />
      </DefineVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('One');
  });

  it('can format multi valued values', () => {
    render(
      <TestVariable name="test" value={['hello', 'world']}>
        <Interpolate id="glob" expr="test.${test}.asd" />
        <Interpolate id="index" expr="test.${test.1}.asd" />
      </TestVariable>,
    );

    expect(screen.getByTestId('glob')).toHaveTextContent(
      'test.{hello,world}.asd',
    );
    // Can use fieldPath index to access specific array value
    expect(screen.getByTestId('index')).toHaveTextContent('test.world.asd');
  });

  it('can format multi valued values using the text format', () => {
    render(
      <TestVariable name="test" value={['1', '2']} text={['hello', 'world']}>
        <Interpolate id="expr" expr="${test:text}" />
      </TestVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('hello + world');
  });

  it('can format multi valued values with the csv, json, pipe and singlequote formats', () => {
    render(
      <TestVariable name="env" value={['prod', 'staging']}>
        <Interpolate id="csv" expr="${env:csv}" />
        <Interpolate id="json" expr="${env:json}" />
        <Interpolate id="pipe" expr="${env:pipe}" />
        <Interpolate id="singlequote" expr="${env:singlequote}" />
        <Interpolate id="legacy" expr="[[env:pipe]]" />
      </TestVariable>,
    );

    expect(screen.getByTestId('csv')).toHaveTextContent('prod,staging');
    expect(screen.getByTestId('json')).toHaveTextContent('["prod","staging"]');
    expect(screen.getByTestId('pipe')).toHaveTextContent('prod|staging');
    expect(screen.getByTestId('singlequote')).toHaveTextContent(
      `'prod','staging'`,
    );
    expect(screen.getByTestId('legacy')).toHaveTextContent('prod|staging');
  });

  it('can use formats with arguments', () => {
    render(
      <TestVariable name="test" value={1594671549254}>
        <Interpolate id="expr" expr="${test:date:YYYY-MM}" />
      </TestVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('2020-07');
  });

  it('applies the format argument to expressions without a format of their own', () => {
    render(
      <TestVariable name="test" value={['a.b', 'c']}>
        <Interpolate
          id="expr"
          expr="$test ${test:csv}"
          format={VariableFormatID.Regex}
        />
      </TestVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('(a\\.b|c) a.b,c');
  });

  it('can use a custom formatter', () => {
    const formatter = vi.fn().mockReturnValue('custom');

    render(
      <TestVariable
        name="cluster"
        value={['1', '2']}
        type="custom"
        isMulti
        includeAll
      >
        <Interpolate id="expr" expr="$cluster" format={formatter} />
      </TestVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('custom');
    expect(formatter.mock.calls[0][0]).toEqual(['1', '2']);
    expect(formatter.mock.calls[0][1]).toEqual({
      name: 'cluster',
      type: 'custom',
      multi: true,
      includeAll: true,
    });
  });

  it('falls back to the glob format for an unknown format', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TestVariable name="test" value={['a', 'b']}>
        <Interpolate id="expr" expr="${test:nope}" />
      </TestVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('{a,b}');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('nope'));

    error.mockRestore();
  });

  it('keeps falsy values like 0', () => {
    render(
      <TestVariable name="test" value={0}>
        <Interpolate id="expr" expr="value=${test}" />
      </TestVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('value=0');
  });

  it('leaves an expression for a variable name that exists on the object prototype as is', () => {
    render(
      <DefineVariable name="test" value={{ value: 'hello' }}>
        <Interpolate id="expr" expr="$toString = 1" />
      </DefineVariable>,
    );

    expect(screen.getByTestId('expr')).toHaveTextContent('$toString = 1');
  });

  it('leaves legacy $var / [[var]] / ${var} / ${var.field} / ${var.1} forms unchanged', () => {
    render(
      <DefineVariable name="simple" value={{ value: 'hello' }}>
        <ObjectVariable name="obj" value={{ prop1: 'prop1Value' }}>
          <TestVariable name="arr" value={['a', 'b']}>
            <Interpolate id="dollar" expr="$simple" />
            <Interpolate id="brackets" expr="[[simple]]" />
            <Interpolate id="braces" expr="${simple}" />
            <Interpolate id="field" expr="${obj.prop1}" />
            <Interpolate id="index" expr="${arr.1}" />
          </TestVariable>
        </ObjectVariable>
      </DefineVariable>,
    );

    expect(screen.getByTestId('dollar')).toHaveTextContent('hello');
    expect(screen.getByTestId('brackets')).toHaveTextContent('hello');
    expect(screen.getByTestId('braces')).toHaveTextContent('hello');
    expect(screen.getByTestId('field')).toHaveTextContent('prop1Value');
    expect(screen.getByTestId('index')).toHaveTextContent('b');
  });
});

function Interpolate({
  id,
  expr,
  format,
}: {
  id: string;
  expr: string;
  format?: InterpolationFormatParameter;
}) {
  const [value] = useInterpolator(expr, undefined, format);

  return <div data-testid={id}>{value}</div>;
}

interface TestVariableProps {
  name: string;
  value: unknown;
  text?: unknown;
  type?: string;
  isMulti?: boolean;
  includeAll?: boolean;
  children: React.ReactNode;
}

/**
 * A variable with a fixed value, which can also hold several values. `text`
 * answers the `text` field path, and an index picks one of several values.
 */
function TestVariable({
  name,
  value,
  text,
  children,
  ...rest
}: TestVariableProps) {
  const parent = useContext(VariableContext);
  const context: VariableContextState & Record<string, unknown> = {
    ...rest,
    name,
    value,
    parent,
    getValue: (fieldPath) => {
      if (fieldPath === 'text') {
        return text;
      }

      if (fieldPath !== undefined && Array.isArray(value)) {
        return value[Number(fieldPath)];
      }

      return value;
    },
    onChange: () => {},
    onOptionsChange: () => {},
    onSetLoading: () => {},
    onSetError: () => {},
  };

  return (
    <VariableContext.Provider value={context}>
      {children}
    </VariableContext.Provider>
  );
}
