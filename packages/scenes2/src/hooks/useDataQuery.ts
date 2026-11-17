import {
  keepPreviousData,
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useContext, useId, useMemo } from 'react';
import { lastValueFrom } from 'rxjs';
import {
  LoadingState,
  rangeUtil,
  type DataQuery,
  type DataQueryRequest,
  type DataSourceRef,
  type PanelData,
} from '@grafana/data';
import { getDataSourceSrv, getRunRequest } from '@grafana/runtime';

import { AdhocFiltersContext } from '../filters/AdhocFiltersContext';
import { useTimeRange } from './useTimeRange';

// import { hasCustomVariableSupport } from './Components/variables/query/guards';
// import { useInterpolatableVariablesResolved } from './hooks/variables/useInterpolatableVariablesResolved';
// import { useVariableInterpolator } from './hooks/variables/useVariableInterpolator';
// import { useVariables } from './hooks/variables/useVariables';
// import { variablesToScopedVars } from './utils/variables';

export interface DataQueryOptions<T extends DataQuery> {
  enabled?: boolean;
  queries: T[];
  staleTime?: number;
  maxDataPoints?: number;
  minInterval?: string;
}

export function useDataQuery<T extends DataQuery>(
  options: DataQueryOptions<T>,
): UseQueryResult<PanelData, Error> {
  const requestId = useId();
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
  const queryKey = ['data', queries, timeRangeKey, filters];

  const queryOptions: UseQueryOptions<PanelData> = {
    enabled: dsQuery.data != null && options.enabled !== false,
    staleTime: staleTime,
    queryKey: queryKey,
    // A refresh or a time range change gives the query a new key. Keep showing
    // the previous result until the new one arrives instead of clearing it.
    placeholderData: keepPreviousData,
    queryFn: () => {
      const request: DataQueryRequest = {
        requestId: requestId + `-${Date.now()}`,
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

      return lastValueFrom(obs);
    },
  };

  const result = useQuery<PanelData, Error>(queryOptions);
  const { data, isFetching } = result;

  // The previous result keeps its Done state while it stands in for the new
  // query. Mark it as loading so panels show that a query is running.
  const dataWithState = useMemo(
    () =>
      data && isFetching && data.state !== LoadingState.Loading
        ? { ...data, state: LoadingState.Loading }
        : data,
    [data, isFetching],
  );

  if (dataWithState === data) {
    return result;
  }

  return { ...result, data: dataWithState } as UseQueryResult<PanelData, Error>;
}

export function findFirstDatasource(
  targets: DataQuery[],
): DataSourceRef | undefined {
  return targets.find((t) => t.datasource !== null)?.datasource ?? undefined;
}
