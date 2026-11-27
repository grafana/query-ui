import { describe, expect, it } from 'vitest';
import {
  type DataContextScopedVar,
  FieldType,
  toDataFrame,
} from '@grafana/data';

import { interpolate } from '../interpolation/useInterpolator';
import type { QueryUIScopedVars } from '../types';

function interpolateString(target: string, scopedVars: QueryUIScopedVars) {
  return interpolate(target, undefined, scopedVars)[0];
}

describe('DataValueMacro', () => {
  const data = toDataFrame({
    name: 'frameName',
    refId: 'refIdA',
    fields: [
      {
        name: 'CoolNumber',
        type: FieldType.number,
        values: [5, 10],
        labels: { cluster: 'US', region: 'west=1' },
        display: (value: number) => {
          return { text: value.toString(), numeric: value, suffix: '%' };
        },
      },
      {
        name: 'time',
        type: FieldType.time,
        values: [5000, 10000],
      },
    ],
  });

  it('Can use use ${__value.*} interpolation when dataContext exist', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
        rowIndex: 1,
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(interpolateString('${__value.raw}', scopedVars)).toBe('10');
    expect(interpolateString('${__value.numeric}', scopedVars)).toBe('10');
    expect(interpolateString('${__value}', scopedVars)).toBe('10%');
    expect(interpolateString('${__value.text}', scopedVars)).toBe('10%');
    expect(interpolateString('${__value.time}', scopedVars)).toBe('10000');
  });

  it('Can use use ${__value.*} when rowIndex is 0', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
        rowIndex: 0,
      },
    };

    const scopedVars = { __dataContext: dataContext };
    expect(interpolateString('${__value.raw}', scopedVars)).toBe('5');
  });

  it('Can use use ${__value.*} with calculatedValue', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
        calculatedValue: {
          text: '15',
          numeric: 15,
          suffix: '%',
        },
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(interpolateString('${__value.raw}', scopedVars)).toBe('15');
    expect(interpolateString('${__value.numeric}', scopedVars)).toBe('15');
    expect(interpolateString('${__value.text}', scopedVars)).toBe('15%');
    expect(interpolateString('${__value}', scopedVars)).toBe('15%');
    expect(interpolateString('${__value.time}', scopedVars)).toBe('');
  });

  it('Should leave expression intact when there is no dataContext', () => {
    expect(interpolateString('${__value.raw}', {})).toBe('${__value.raw}');
  });

  it('Should interpolate __data.* correctly', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
        rowIndex: 1,
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(interpolateString('${__data.fields[1]}', scopedVars)).toBe('10000');
    expect(interpolateString('${__data.fields[0]}', scopedVars)).toBe('10%');
    expect(interpolateString('${__data.fields[0].text}', scopedVars)).toBe(
      '10',
    );
    expect(
      interpolateString('${__data.fields["CoolNumber"].text}', scopedVars),
    ).toBe('10');
    expect(interpolateString('${__data.name}', scopedVars)).toBe('frameName');
    expect(interpolateString('${__data.refId}', scopedVars)).toBe('refIdA');
    expect(
      interpolateString('${__data.fields[0]:percentencode}', scopedVars),
    ).toBe('10%25');
  });

  it('${__data.*} should return match when the rowIndex is missing dataContext is not there', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(interpolateString('${__data.name}', scopedVars)).toBe(
      '${__data.name}',
    );
  });

  it('Should interpolate ${__series} to frame display name', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
        frameIndex: 0,
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(interpolateString('${__series.name}', scopedVars)).toBe('frameName');
  });

  it('Should interpolate ${__field.*} correctly', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
        frameIndex: 0,
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(interpolateString('${__field.name}', scopedVars)).toBe('CoolNumber');
    expect(interpolateString('${__field.labels.cluster}', scopedVars)).toBe(
      'US',
    );
    expect(
      interpolateString('${__field.labels.region:percentencode}', scopedVars),
    ).toBe('west%3D1');
  });
});
