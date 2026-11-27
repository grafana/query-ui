import { act, renderHook, waitFor } from '@testing-library/react';
import { map, mergeMap, Subject, take } from 'rxjs';
import {
  type CustomTransformOperator,
  type DataFrame,
  DataTopic,
  type DataTransformerConfig,
  type DataTransformerInfo,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';

import {
  type DataTransformation,
  useDataTransformer,
} from './useDataTransformer';

const multiplySpy = vi.fn();

function mapValues(fn: (v: number) => number) {
  return map((frames: DataFrame[]) =>
    frames.map((frame) => ({
      ...frame,
      fields: frame.fields.map((field) => ({
        ...field,
        values: field.values.map(fn),
      })),
    })),
  );
}

const multiplyTransformer: DataTransformerInfo<{ factor: number }> = {
  id: 'multiply',
  name: 'Multiply',
  operator: (options) => (source) => {
    multiplySpy(options);
    return source.pipe(mapValues((v) => v * options.factor));
  },
};

const addTransformer: DataTransformerInfo<{ amount: number }> = {
  id: 'add',
  name: 'Add',
  operator: (options) => (source) =>
    source.pipe(mapValues((v) => v + options.amount)),
};

const failingTransformer: DataTransformerInfo = {
  id: 'failing',
  name: 'Failing',
  operator: () => () => {
    throw new Error('boom');
  },
};

/** One gate per pass. A pass passes its frames on when the test opens its gate. */
let gates: Array<Subject<void>>;

const gatedTransformer: DataTransformerInfo = {
  id: 'gated',
  name: 'Gated',
  operator: () => (source) =>
    source.pipe(
      mergeMap((frames) => {
        const gate = new Subject<void>();
        gates.push(gate);
        return gate.pipe(
          take(1),
          map(() => frames),
        );
      }),
    ),
};

beforeAll(() => {
  standardTransformersRegistry.setInit(() =>
    [
      multiplyTransformer,
      addTransformer,
      failingTransformer,
      gatedTransformer,
    ].map((info) => ({
      id: info.id,
      name: info.name,
      description: '',
      transformation: () => Promise.resolve(info),
      editor: () => null,
      imageDark: '',
      imageLight: '',
    })),
  );
});

beforeEach(() => {
  multiplySpy.mockClear();
  gates = [];
});

const multiplyBy2: DataTransformerConfig = {
  id: 'multiply',
  options: { factor: 2 },
};

const add4ToAnnotations: DataTransformerConfig = {
  id: 'add',
  options: { amount: 4 },
  topic: DataTopic.Annotations,
};

function annotationFrame(values: number[]): DataFrame {
  return {
    ...toDataFrame({ fields: [{ name: 'time', values }] }),
    meta: { dataTopic: DataTopic.Annotations },
  };
}

function panelData(
  values: number[],
  overrides: Partial<PanelData> = {},
): PanelData {
  return {
    state: LoadingState.Done,
    timeRange: getDefaultTimeRange(),
    series: [toDataFrame({ fields: [{ name: 'value', values }] })],
    annotations: [annotationFrame([100])],
    ...overrides,
  };
}

function seriesValues(data: PanelData | undefined) {
  return data?.series[0]?.fields[0]?.values;
}

function annotationValues(data: PanelData | undefined) {
  return data?.annotations?.[0]?.fields[0]?.values;
}

function renderTransformer(
  transformations: DataTransformation[],
  data: PanelData | undefined,
) {
  return renderHook(
    ({ transformations, data }) => useDataTransformer(transformations, data),
    { initialProps: { transformations, data } },
  );
}

describe('useDataTransformer', () => {
  it('returns the data as it is when there are no transformations', () => {
    const data = panelData([1, 2, 3]);
    const { result } = renderTransformer([], data);

    expect(result.current).toBe(data);
  });

  it('returns undefined when there is no data', () => {
    const { result } = renderTransformer([multiplyBy2], undefined);

    expect(result.current).toBeUndefined();
  });

  it('applies transformations to the series', async () => {
    const { result } = renderTransformer([multiplyBy2], panelData([1, 2, 3]));

    await waitFor(() =>
      expect(seriesValues(result.current)).toEqual([2, 4, 6]),
    );
    expect(result.current?.state).toBe(LoadingState.Done);
  });

  it('never returns untransformed frames before the first pass is done', async () => {
    const { result } = renderTransformer([multiplyBy2], panelData([1]));

    expect(result.current).toBeUndefined();
    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));
  });

  it('applies transformations in order', async () => {
    const { result } = renderTransformer(
      [multiplyBy2, { id: 'add', options: { amount: 1 } }],
      panelData([1, 2]),
    );

    await waitFor(() => expect(seriesValues(result.current)).toEqual([3, 5]));
  });

  it('applies annotation transformations to annotations only', async () => {
    const { result } = renderTransformer(
      [multiplyBy2, add4ToAnnotations],
      panelData([1]),
    );

    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));
    expect(annotationValues(result.current)).toEqual([104]);
  });

  it('passes annotations through when no transformation targets them', async () => {
    const { result } = renderTransformer([multiplyBy2], panelData([1]));

    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));
    expect(annotationValues(result.current)).toEqual([100]);
  });

  it('applies custom transform operators', async () => {
    const divideBy10: CustomTransformOperator = () => (source) =>
      source.pipe(mapValues((v) => v / 10));

    const { result } = renderTransformer(
      [divideBy10, multiplyBy2],
      panelData([10, 20]),
    );

    await waitFor(() => expect(seriesValues(result.current)).toEqual([2, 4]));
  });

  it('moves frames a transformation marks as annotations', async () => {
    const toAnnotations: CustomTransformOperator = () => (source) =>
      source.pipe(
        map((frames) =>
          frames.map((frame) => ({
            ...frame,
            meta: { ...frame.meta, dataTopic: DataTopic.Annotations },
          })),
        ),
      );

    const { result } = renderTransformer([toAnnotations], panelData([1]));

    await waitFor(() => expect(result.current?.annotations).toHaveLength(2));
    expect(result.current?.series).toEqual([]);
  });

  it('skips disabled transformations', async () => {
    const { result } = renderTransformer(
      [
        { ...multiplyBy2, disabled: true },
        { id: 'add', options: { amount: 1 } },
      ],
      panelData([1]),
    );

    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));
  });

  it('transforms new frames when the data changes', async () => {
    const { result, rerender } = renderTransformer(
      [multiplyBy2],
      panelData([1]),
    );

    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));

    rerender({ transformations: [multiplyBy2], data: panelData([5]) });

    await waitFor(() => expect(seriesValues(result.current)).toEqual([10]));
  });

  it('re-runs when the transformations change', async () => {
    const data = panelData([1]);
    const { result, rerender } = renderTransformer([multiplyBy2], data);

    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));

    rerender({
      transformations: [{ id: 'multiply', options: { factor: 3 } }],
      data,
    });

    await waitFor(() => expect(seriesValues(result.current)).toEqual([3]));
  });

  it('does not re-run for equal transformations in a new array', async () => {
    const data = panelData([1]);
    const { result, rerender } = renderTransformer(
      [{ id: 'multiply', options: { factor: 2 } }],
      data,
    );

    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));
    const transformed = result.current;

    rerender({
      transformations: [{ id: 'multiply', options: { factor: 2 } }],
      data,
    });

    expect(result.current).toBe(transformed);
    expect(multiplySpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the transformed frames when only the metadata changes', async () => {
    const data = panelData([1]);
    const { result, rerender } = renderTransformer([multiplyBy2], data);

    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));

    rerender({
      transformations: [multiplyBy2],
      data: { ...data, state: LoadingState.Loading },
    });

    expect(result.current?.state).toBe(LoadingState.Loading);
    expect(seriesValues(result.current)).toEqual([2]);
    expect(multiplySpy).toHaveBeenCalledTimes(1);
  });

  it('returns the previous frames in the loading state while a pass runs', async () => {
    const { result, rerender } = renderTransformer(
      [multiplyBy2],
      panelData([1]),
    );

    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));

    rerender({
      transformations: [multiplyBy2, { id: 'gated', options: {} }],
      data: panelData([5]),
    });

    expect(seriesValues(result.current)).toEqual([2]);
    expect(result.current?.state).toBe(LoadingState.Loading);

    await waitFor(() => expect(gates).toHaveLength(1));
    gates[0].next();

    await waitFor(() => expect(seriesValues(result.current)).toEqual([10]));
    expect(result.current?.state).toBe(LoadingState.Done);
  });

  it('drops a stale pass when new data arrives', async () => {
    const gated: DataTransformation[] = [{ id: 'gated', options: {} }];
    const { result, rerender } = renderTransformer(gated, panelData([1]));

    await waitFor(() => expect(gates).toHaveLength(1));

    rerender({ transformations: gated, data: panelData([2]) });
    await waitFor(() => expect(gates).toHaveLength(2));

    gates[1].next();
    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));

    // The first pass finishing late must not overwrite the newer result.
    await act(async () => gates[0].next());
    expect(seriesValues(result.current)).toEqual([2]);
    expect(result.current?.state).toBe(LoadingState.Done);
  });

  it('returns to the data as it is when the transformations are removed', async () => {
    const data = panelData([1]);
    const { result, rerender } = renderTransformer([multiplyBy2], data);

    await waitFor(() => expect(seriesValues(result.current)).toEqual([2]));

    rerender({ transformations: [], data });

    expect(result.current).toBe(data);
  });

  it('reports a failing transformation as an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const upstreamError = { message: 'upstream' };

    const { result } = renderTransformer(
      [{ id: 'failing', options: {} }],
      panelData([1], { errors: [upstreamError] }),
    );

    await waitFor(() => expect(result.current?.state).toBe(LoadingState.Error));
    expect(result.current?.errors).toEqual([
      upstreamError,
      { message: 'Error transforming data: boom' },
    ]);
    expect(seriesValues(result.current)).toEqual([1]);
  });
});
