import { describe, expect, it } from 'vitest';

import type { FilterDraft } from './editorState';
import {
  expressionToFilter,
  type FilterExpressionInput,
  formatFilterExpression,
  getFilterExpression,
  type ParsedFilterExpression,
  parseFilterExpression,
} from './filterExpression';

describe('parseFilterExpression', () => {
  // Wider than OPERATORS, to check longest-match on shared prefixes.
  const operators = ['=', '!=', '=|', '!=|', '=~', '!~', '<', '<=', '>', '>='];

  it.each<[string, ParsedFilterExpression]>([
    ['instance = tempo', { key: 'instance', operator: '=', value: 'tempo' }],
    [
      'instance!=tempo-distributor',
      { key: 'instance', operator: '!=', value: 'tempo-distributor' },
    ],
    ['error_rate >= 0.5', { key: 'error_rate', operator: '>=', value: '0.5' }],
    [
      'method =~ GET|POST',
      { key: 'method', operator: '=~', value: 'GET|POST' },
    ],
    ['region =| us-east', { key: 'region', operator: '=|', value: 'us-east' }],
    [
      'region !=| us-east',
      { key: 'region', operator: '!=|', value: 'us-east' },
    ],
    ['method !~ DELETE', { key: 'method', operator: '!~', value: 'DELETE' }],
    ['latency < 100', { key: 'latency', operator: '<', value: '100' }],
    ['latency <= 100', { key: 'latency', operator: '<=', value: '100' }],
    ['instance=', { key: 'instance', operator: '=', value: '' }],
    ['instance = ', { key: 'instance', operator: '=', value: '' }],
    [
      'my.label-name = foo',
      { key: 'my.label-name', operator: '=', value: 'foo' },
    ],
    ['key!=|val', { key: 'key', operator: '!=|', value: 'val' }],
    [
      '  instance = tempo  ',
      { key: 'instance', operator: '=', value: 'tempo' },
    ],
    ['= tempo', { key: undefined, operator: '=', value: 'tempo' }],
    ['!=tempo', { key: undefined, operator: '!=', value: 'tempo' }],
    ['!=| us-east', { key: undefined, operator: '!=|', value: 'us-east' }],
    ['=', { key: undefined, operator: '=', value: '' }],
    [
      'key = value=with=equals',
      { key: 'key', operator: '=', value: 'value=with=equals' },
    ],
    [
      'region =| us-east, us-west',
      { key: 'region', operator: '=|', value: 'us-east, us-west' },
    ],
  ])('parses "%s"', (input, expected) => {
    expect(parseFilterExpression(input, operators)).toEqual(expected);
  });

  it.each(['just-a-key', 'plain text', '', '   '])(
    'returns null for "%s"',
    (input) => {
      expect(parseFilterExpression(input, operators)).toBeNull();
    },
  );

  it('defaults to the built-in operators', () => {
    expect(parseFilterExpression('env !=| dev')).toEqual({
      key: 'env',
      operator: '!=|',
      value: 'dev',
    });
    // `>` isn't a built-in operator.
    expect(parseFilterExpression('latency > 100')).toBeNull();
  });
});

describe('getFilterExpression', () => {
  const keyStep: FilterExpressionInput = {
    inputValue: '',
    step: 'key',
    draft: {},
    allowCustomValue: true,
    populateInput: false,
  };
  const envDraft: FilterDraft = { key: 'env', keyLabel: 'Environment' };

  it('resolves a full expression typed while picking a key', () => {
    expect(
      getFilterExpression({ ...keyStep, inputValue: 'env = prod' }),
    ).toEqual({
      key: 'env',
      keyLabel: 'env',
      operator: '=',
      values: ['prod'],
    });
  });

  it('resolves a key and operator without a value', () => {
    expect(
      getFilterExpression({ ...keyStep, inputValue: 'env !=' })?.values,
    ).toEqual([]);
  });

  it('needs a key while picking a key', () => {
    expect(
      getFilterExpression({ ...keyStep, inputValue: '= prod' }),
    ).toBeNull();
  });

  it('uses the picked key while picking an operator', () => {
    expect(
      getFilterExpression({
        ...keyStep,
        step: 'operator',
        draft: envDraft,
        inputValue: '!= dev',
      }),
    ).toEqual({
      key: 'env',
      keyLabel: 'Environment',
      operator: '!=',
      values: ['dev'],
    });
  });

  it('splits, trims, and drops empty values for multi-value operators', () => {
    expect(
      getFilterExpression({ ...keyStep, inputValue: 'env =| prod, , dev ,' })
        ?.values,
    ).toEqual(['prod', 'dev']);
  });

  it('keeps commas in single values', () => {
    expect(
      getFilterExpression({ ...keyStep, inputValue: 'env = a,b' })?.values,
    ).toEqual(['a,b']);
  });

  it.each<[string, Partial<FilterExpressionInput>]>([
    ['custom values are off', { allowCustomValue: false }],
    [
      'picking a value',
      { step: 'value', draft: { ...envDraft, operator: '=' } },
    ],
    ['editing a clicked pill', { populateInput: true }],
    ['the text has no operator', { inputValue: 'env' }],
  ])('is off when %s', (_name, override) => {
    expect(
      getFilterExpression({
        ...keyStep,
        inputValue: 'env = prod',
        ...override,
      }),
    ).toBeNull();
  });
});

describe('expressionToFilter', () => {
  it('builds a single-value filter that clears old multi values', () => {
    expect(
      expressionToFilter({
        key: 'env',
        keyLabel: 'env',
        operator: '!=',
        values: ['dev'],
      }),
    ).toEqual({
      key: 'env',
      keyLabel: 'env',
      operator: '!=',
      value: 'dev',
      valueLabels: ['dev'],
      values: undefined,
    });
  });

  it('builds a multi-value filter', () => {
    expect(
      expressionToFilter({
        key: 'env',
        keyLabel: 'env',
        operator: '=|',
        values: ['prod', 'dev'],
      }),
    ).toEqual({
      key: 'env',
      keyLabel: 'env',
      operator: '=|',
      value: 'prod',
      values: ['prod', 'dev'],
      valueLabels: ['prod', 'dev'],
    });
  });

  it('has nothing to build without a value', () => {
    expect(
      expressionToFilter({
        key: 'env',
        keyLabel: 'env',
        operator: '=',
        values: [],
      }),
    ).toBeUndefined();
  });
});

describe('formatFilterExpression', () => {
  it('reads back the expression', () => {
    expect(
      formatFilterExpression({
        key: 'env',
        keyLabel: 'env',
        operator: '=|',
        values: ['prod', 'dev'],
      }),
    ).toBe('env =| prod, dev');
    expect(
      formatFilterExpression({
        key: 'env',
        keyLabel: 'env',
        operator: '=',
        values: [],
      }),
    ).toBe('env =');
  });
});
