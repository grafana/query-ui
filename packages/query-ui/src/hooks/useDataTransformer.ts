import { isEqual } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { forkJoin, map, type Observable } from 'rxjs';
import {
  type CustomTransformOperator,
  type DataFrame,
  type DataQueryError,
  DataTopic,
  type DataTransformerConfig,
  LoadingState,
  type PanelData,
  transformDataFrame,
} from '@grafana/data';

/** A registered transformation config, or a custom operator defined in code. */
export type DataTransformation =
  DataTransformerConfig | CustomTransformOperator;

interface TransformResult {
  /** The inputs this result was computed from. */
  transformations: DataTransformation[];
  series: DataFrame[];
  annotations: DataFrame[] | undefined;
  /** The output frames. On error these are the untransformed input frames. */
  output: { series: DataFrame[]; annotations: DataFrame[] };
  error?: DataQueryError;
}

/**
 * Applies transformations to panel data and returns the transformed data.
 *
 * Transformations run when the series or annotation frames change, or when the
 * transformations change. A change to the rest of the data, such as its loading
 * state, keeps the transformed frames. Transformations run asynchronously, so
 * until the first pass is done the hook returns `undefined`. While a later pass
 * runs it returns the previous transformed frames in the loading state: it never
 * returns untransformed frames.
 *
 * The transformations are compared by value, so an inline array of configs is
 * fine. Custom operators are compared by reference: define them outside the
 * component or memoize them, or cause an endless render loop.
 */
export function useDataTransformer(
  transformations: DataTransformation[],
  data: PanelData | undefined,
): PanelData | undefined {
  const stableTransformations = useDeepEqualValue(transformations);
  const [result, setResult] = useState<TransformResult>();
  const series = data?.series;
  const annotations = data?.annotations;
  const hasTransformations = stableTransformations.length > 0;

  useEffect(() => {
    if (!series || !hasTransformations) {
      return;
    }

    const inputs = {
      transformations: stableTransformations,
      series,
      annotations,
    };

    // Unsubscribing on cleanup drops a pass that new inputs made stale, so a
    // slow pass can't overwrite the result of a newer one.
    const sub = applyTransformations(
      stableTransformations,
      series,
      annotations ?? [],
    ).subscribe({
      next: (output) => setResult({ ...inputs, output }),
      error: (err: unknown) => {
        console.error('Error transforming data: ', err);
        setResult({
          ...inputs,
          output: { series, annotations: annotations ?? [] },
          error: toTransformationError(err),
        });
      },
    });

    return () => sub.unsubscribe();
  }, [stableTransformations, hasTransformations, series, annotations]);

  return useMemo(() => {
    if (!data || !hasTransformations) {
      return data;
    }

    if (!result) {
      return undefined;
    }

    const isCurrent =
      result.transformations === stableTransformations &&
      result.series === data.series &&
      result.annotations === data.annotations;

    if (!isCurrent) {
      return { ...data, ...result.output, state: LoadingState.Loading };
    }

    if (result.error) {
      return {
        ...data,
        ...result.output,
        state: LoadingState.Error,
        errors: [...(data.errors ?? []), result.error],
      };
    }

    return { ...data, ...result.output };
  }, [data, hasTransformations, result, stableTransformations]);
}

/**
 * Runs each transformation on the frames of its topic: series by default, or
 * annotations when its config says so. A transformation can turn frames into
 * the other topic by setting `meta.dataTopic`, so the output is sorted by that.
 */
function applyTransformations(
  transformations: DataTransformation[],
  series: DataFrame[],
  annotations: DataFrame[],
): Observable<{ series: DataFrame[]; annotations: DataFrame[] }> {
  const seriesTransformations = transformations.filter(
    (t) => getTopic(t) === DataTopic.Series,
  );
  const annotationTransformations = transformations.filter(
    (t) => getTopic(t) === DataTopic.Annotations,
  );

  return forkJoin([
    transformDataFrame(seriesTransformations, series),
    transformDataFrame(annotationTransformations, annotations),
  ]).pipe(
    map((results) => {
      const output = {
        series: [] as DataFrame[],
        annotations: [] as DataFrame[],
      };

      for (const frame of results.flat()) {
        if (frame.meta?.dataTopic === DataTopic.Annotations) {
          output.annotations.push(frame);
        } else {
          output.series.push(frame);
        }
      }

      return output;
    }),
  );
}

function getTopic(transformation: DataTransformation): DataTopic {
  if (typeof transformation === 'function') {
    return DataTopic.Series;
  }

  return transformation.topic ?? DataTopic.Series;
}

function toTransformationError(err: unknown): DataQueryError {
  const message = err instanceof Error ? err.message : String(err);
  return { message: `Error transforming data: ${message}` };
}

/** Returns the previous value for as long as the new one is deeply equal. */
function useDeepEqualValue<T>(value: T): T {
  const [stable, setStable] = useState(value);

  if (stable !== value && !isEqual(stable, value)) {
    setStable(value);
    return value;
  }

  return stable;
}
