import {
  hashKey,
  keepPreviousData,
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useContext, useMemo } from 'react';
import { fromEvent, lastValueFrom, takeUntil } from 'rxjs';
import {
  LoadingState,
  rangeUtil,
  type DataQuery,
  type DataQueryRequest,
  type DataSourceRef,
  type PanelData,
  type TimeRange,
} from '@grafana/data';
import { getDataSourceSrv, getRunRequest } from '@grafana/runtime';

import { AdhocFiltersContext } from '../filters/AdhocFiltersContext';
import { useTimeRange } from './useTimeRange';

export interface DataQueryOptions<T extends DataQuery> {
  enabled?: boolean;
  queries: T[];
  staleTime?: number;
  maxDataPoints?: number;
  minInterval?: string;
}

/**
 * First element of every data query key. Use it to select all data queries, for
 * example `queryClient.cancelQueries({ queryKey: [dataQueryKey] })`.
 */
export const dataQueryKey = 'data';

export function useDataQuery<T extends DataQuery>(
  options: DataQueryOptions<T>,
): UseQueryResult<PanelData, Error> {
  const runRequest = getRunRequest();
  const dataSourceSrv = getDataSourceSrv();
  const timeRangeCtx = useTimeRange();
  const adhocFiltersCtx = useContext(AdhocFiltersContext);
  const interpolate = (value: string) => value; // TODO: use actual variable interpolation
  const timeRange = timeRangeCtx.value;
  const staleTime = options.staleTime ?? 30000;
  const filters = adhocFiltersCtx?.filters;

  const dsRef = findFirstDatasource(options.queries);
  const dsQuery = useQuery({
    queryKey: ['ds', dsRef],
    queryFn: () => dataSourceSrv.get(dsRef),
    staleTime: Infinity,
  });

  const timeRangeKey = `${timeRange.from.valueOf()}-${timeRange.to.valueOf()}`;
  const queries = options.queries;
  const maxDataPoints = options.maxDataPoints ?? 500;
  const queryKey = [dataQueryKey, queries, timeRangeKey, filters];
  const enabled = dsQuery.data != null && options.enabled !== false;
  // The request carries the query's hash as its id, so anything holding the
  // resulting PanelData (like VizPanel) can find the query and cancel it.
  const requestId = hashKey(queryKey);

  const queryOptions: UseQueryOptions<PanelData> = {
    enabled,
    staleTime: staleTime,
    queryKey: queryKey,
    // A refresh or a time range change gives the query a new key. Keep showing
    // the previous result until the new one arrives instead of clearing it.
    placeholderData: keepPreviousData,
    // Reading `signal` opts the query in to cancellation: react-query aborts it
    // when the query is canceled or loses its last observer.
    queryFn: ({ signal }) => {
      const request: DataQueryRequest = {
        requestId,
        targets: queries,
        app: 'demo-app',
        range: timeRange,
        rangeRaw: timeRange.raw,
        startTime: Date.now(),
        // TODO: use actual values for the following properties
        timezone: 'utc',
        interval: '1m',
        intervalMs: 6000,
        maxDataPoints: maxDataPoints,
        scopedVars: {},
        liveStreaming: false,
        filters,
      };

      const lowerIntervalLimit = options.minInterval
        ? interpolate(options.minInterval)
        : dsQuery.data?.interval;

      const norm = rangeUtil.calculateInterval(
        timeRange,
        maxDataPoints!,
        lowerIntervalLimit,
      );

      request.scopedVars = {
        __interval: { text: norm.interval, value: norm.interval },
        __interval_ms: {
          text: norm.intervalMs.toString(),
          value: norm.intervalMs,
        },
      };

      request.interval = norm.interval;
      request.intervalMs = norm.intervalMs;

      const obs = runRequest(dsQuery.data!, request);

      // Unsubscribing on abort is what cancels the datasource request. Without
      // it react-query drops the result, but the request keeps running.
      return lastValueFrom(obs.pipe(takeUntil(fromEvent(signal, 'abort'))));
    },
  };

  const result = useQuery<PanelData, Error>(queryOptions);
  const { data, isFetching, status, fetchStatus } = result;

  // An enabled query that is pending and idle was canceled before it had any
  // data. Without data the panel would show its loading state forever.
  const isCanceled = enabled && status === 'pending' && fetchStatus === 'idle';

  const dataWithState = useMemo(() => {
    if (!data) {
      return isCanceled ? emptyData(timeRange) : data;
    }

    if (
      !isFetching ||
      (data.state === LoadingState.Loading &&
        data.request?.requestId === requestId)
    ) {
      return data;
    }

    // The previous result stands in for the new query while it runs. Mark it
    // as loading so panels show that a query is running, and point its request
    // id at the running query so canceling from the panel reaches it.
    return {
      ...data,
      state: LoadingState.Loading,
      request: data.request && { ...data.request, requestId },
    };
  }, [data, isFetching, isCanceled, timeRange, requestId]);

  if (dataWithState === data) {
    return result;
  }

  return { ...result, data: dataWithState } as UseQueryResult<PanelData, Error>;
}

function emptyData(timeRange: TimeRange): PanelData {
  return { state: LoadingState.Done, series: [], timeRange };
}

export function findFirstDatasource(
  targets: DataQuery[],
): DataSourceRef | undefined {
  return targets.find((t) => t.datasource !== null)?.datasource ?? undefined;
}
