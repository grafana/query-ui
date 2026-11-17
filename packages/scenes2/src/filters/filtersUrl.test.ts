import { describe, expect, it } from 'vitest';

import { deserializeFilters, serializeFilters } from './filtersUrl';

describe('serializeFilters', () => {
  it('writes a filter as key, operator and value', () => {
    expect(
      serializeFilters([{ key: 'env', operator: '=', value: 'prod' }]),
    ).toEqual(['env|=|prod']);
  });

  it('writes labels after a comma, and leaves out one that matches', () => {
    expect(
      serializeFilters([
        {
          key: 'env',
          keyLabel: 'Environment',
          operator: '=',
          value: 'prod',
          valueLabels: ['prod'],
        },
      ]),
    ).toEqual(['env,Environment|=|prod']);

    expect(
      serializeFilters([
        {
          key: 'env',
          operator: '=',
          value: 'prod',
          valueLabels: ['Production'],
        },
      ]),
    ).toEqual(['env|=|prod,Production']);
  });

  it('writes every value of a multi-value operator', () => {
    expect(
      serializeFilters([
        {
          key: 'env',
          operator: '=|',
          value: 'a',
          values: ['a', 'b'],
          valueLabels: ['A', 'b'],
        },
      ]),
    ).toEqual(['env|=__gfp__|a,A|b']);
  });

  it('writes one value for each filter', () => {
    expect(
      serializeFilters([
        { key: 'env', operator: '=', value: 'prod' },
        { key: 'region', operator: '!=', value: 'eu' },
      ]),
    ).toEqual(['env|=|prod', 'region|!=|eu']);
  });

  it('leaves out filters that are not complete', () => {
    expect(
      serializeFilters([
        { key: '', operator: '=', value: 'prod' },
        { key: 'env', operator: '', value: 'prod' },
        { key: 'env', operator: '=', value: '' },
        { key: 'env', operator: '=|', value: '', values: [] },
      ]),
    ).toEqual([]);
  });
});

describe('deserializeFilters', () => {
  it('reads what serializeFilters wrote, delimiters in the text included', () => {
    const filters = [
      {
        key: 'a|b',
        keyLabel: 'a, b',
        operator: '=',
        value: 'x#y',
        valueLabels: ['x#y'],
      },
      {
        key: 'env',
        keyLabel: 'env',
        operator: '=|',
        value: 'a',
        values: ['a', 'b|c'],
        valueLabels: ['A', 'b|c'],
      },
    ];

    expect(deserializeFilters(serializeFilters(filters))).toEqual(filters);
  });

  it('reads a filter written by Grafana Scenes', () => {
    expect(deserializeFilters(['env|=|prod,Production'])).toEqual([
      {
        key: 'env',
        keyLabel: 'env',
        operator: '=',
        value: 'prod',
        valueLabels: ['Production'],
      },
    ]);
  });

  it('drops entries without a key or operator', () => {
    expect(deserializeFilters(['|=|a', 'env', '', 'env|=|b'])).toEqual([
      {
        key: 'env',
        keyLabel: 'env',
        operator: '=',
        value: 'b',
        valueLabels: ['b'],
      },
    ]);
  });

  it('reads an empty entry as no filters', () => {
    expect(deserializeFilters([''])).toEqual([]);
  });
});
