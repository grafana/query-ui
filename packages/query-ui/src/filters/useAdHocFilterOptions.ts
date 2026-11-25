import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { GetTagResponse, MetricFindValue } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { useAdhocFilters } from '../hooks/useAdhocFilters';
import { useTimeRange } from '../hooks/useTimeRange';
import { useInterpolator } from '../variables/interpolation/useInterpolator';
import type { EditorOption, EditorStep } from './editorState';
import { type AdHocFilterWithLabels, OPERATORS } from './filterModel';

export interface AdHocFilterOptionsInput {
  step: EditorStep;
  /** Fetch only while the dropdown is open. */
  enabled: boolean;
  /** The key picked so far, for the values request. */
  key?: string;
  /** The key of the filter being edited, left out of the keys request. */
  editedKey?: string;
}

export interface AdHocFilterOptions {
  options: EditorOption[];
  /** First load, with nothing to show yet. */
  loading: boolean;
  /** Any request in flight, including a background refetch. */
  fetching: boolean;
  error: boolean;
  retry: () => void;
}

const OPERATOR_OPTIONS: EditorOption[] = OPERATORS.map((op) => ({
  value: op.value,
  label: op.value,
  description: op.description,
}));

/** The dropdown options for one editor step: tag keys, operators, or tag values. */
export function useAdHocFilterOptions({
  step,
  enabled,
  key,
  editedKey,
}: AdHocFilterOptionsInput): AdHocFilterOptions {
  const { datasource, filters, baseFilters } = useAdhocFilters();
  const { value: timeRange } = useTimeRange();
  const [dsInterpolated, dsLoading] = useInterpolator(datasource?.uid ?? '');

  const dsQuery = useQuery({
    queryKey: ['ds', dsInterpolated],
    queryFn: () => getDataSourceSrv().get(dsInterpolated ?? undefined),
    enabled: dsInterpolated != null && !dsLoading,
    staleTime: Infinity,
  });

  const timeRangeKey = `${timeRange.from.valueOf()}-${timeRange.to.valueOf()}`;

  // The key query lists keys that fit the other filters, so leave out the
  // filter being edited. The value query does the same for the key being picked.
  const keyFilters = useMemo(
    () => getRequestFilters(filters, baseFilters, editedKey),
    [filters, baseFilters, editedKey],
  );
  const valueFilters = useMemo(
    () => getRequestFilters(filters, baseFilters, key),
    [filters, baseFilters, key],
  );

  const keysQuery = useQuery({
    queryKey: ['adhoc-tag-keys', dsInterpolated, keyFilters, timeRangeKey],
    queryFn: async () =>
      normalizeTagResponse(
        await dsQuery.data?.getTagKeys?.({ filters: keyFilters, timeRange }),
      ),
    enabled: enabled && step === 'key' && dsQuery.data != null,
  });

  const valuesQuery = useQuery({
    queryKey: [
      'adhoc-tag-values',
      dsInterpolated,
      key,
      valueFilters,
      timeRangeKey,
    ],
    queryFn: async () =>
      normalizeTagResponse(
        await dsQuery.data?.getTagValues?.({
          key: key!,
          filters: valueFilters,
          timeRange,
        }),
      ),
    enabled: enabled && step === 'value' && dsQuery.data != null && key != null,
  });

  const keyOptions = useMemo(() => toOptions(keysQuery.data), [keysQuery.data]);
  const valueOptions = useMemo(
    () => toOptions(valuesQuery.data),
    [valuesQuery.data],
  );

  if (step === 'operator') {
    return {
      options: OPERATOR_OPTIONS,
      loading: false,
      fetching: false,
      error: false,
      retry: noop,
    };
  }

  const query = step === 'key' ? keysQuery : valuesQuery;

  return {
    options: step === 'key' ? keyOptions : valueOptions,
    loading: query.isLoading || (enabled && dsQuery.isLoading),
    fetching: query.isFetching,
    error: query.isError || dsQuery.isError,
    retry: () => {
      void query.refetch();
    },
  };
}

function noop() {}

/**
 * The filters sent with a tag keys/values request: the user's filters minus any
 * on the key being edited, followed by the base filters.
 */
function getRequestFilters(
  filters: AdHocFilterWithLabels[],
  baseFilters: AdHocFilterWithLabels[] | undefined,
  excludeKey: string | undefined,
): AdHocFilterWithLabels[] {
  return filters.filter((f) => f.key !== excludeKey).concat(baseFilters ?? []);
}

function toOptions(values: MetricFindValue[] | undefined): EditorOption[] {
  if (!values) {
    return [];
  }

  return values.map((v) => ({
    value: String(v.value ?? v.text),
    label: v.text,
  }));
}

/** getTagKeys/getTagValues can resolve a plain array or the newer { data, error } shape. */
function normalizeTagResponse(
  result: GetTagResponse | MetricFindValue[] | undefined,
): MetricFindValue[] {
  if (!result) {
    return [];
  }

  return Array.isArray(result) ? result : result.data;
}
