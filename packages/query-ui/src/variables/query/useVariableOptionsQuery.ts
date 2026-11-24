import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useEffect, useId, useRef } from 'react';
import {
  CoreApp,
  type DataQueryRequest,
  type ScopedVars,
  VariableSort,
  type VariableRegexApplyTo,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import type { DataQuery } from '@grafana/schema';

import { useTimeRange } from '../../hooks/useTimeRange';
import type { VariableValueOption } from '../types';
import {
  createVariableQueryRunner,
  fetchMetricFindValues,
  type VariableQueryRunnerArgs,
} from './createVariableQueryRunner';
import type { MetricFindValueWithProperties } from './toMetricFindValues';
import {
  mergeStaticOptions,
  metricNamesToVariableValues,
  type StaticOptionsOrder,
} from './utils';

export interface VariableOptionsQueryProps {
  /** Set to false to hold the query, for example while the data source uid is still being interpolated. */
  enabled?: boolean;
  datasource: { uid: string };
  query: string | DataQuery;
  /** Variable name. Used for default refIds and sent to legacy data sources. */
  name?: string;
  /** Filters the query results. Interpolate variables before passing it in. */
  regex?: string;
  /** What the regex is matched against. Defaults to `value`. */
  regexApplyTo?: VariableRegexApplyTo;
  sort?: VariableSort;
  /** Added to the options returned by the query. */
  staticOptions?: VariableValueOption[];
  /** Where static options go relative to the query results. Defaults to `before`. */
  staticOptionsOrder?: StaticOptionsOrder;
  /** Sent to the data source as the `__searchFilter` variable. Debounce it before passing it in. */
  searchFilter?: string;
  staleTime?: number;
}

/**
 * Does not define or lookup any variable
 * This only handles the actual fetching of variable options via the
 * DataSourceAPI variable query abstractions.
 */
export function useVariableOptionsQuery(
  props: VariableOptionsQueryProps,
): UseQueryResult<VariableValueOption[], Error> {
  const { enabled = true, searchFilter } = props;
  const getQuery = useOptionsQueryDefinition(props);

  return useQuery({ ...getQuery(searchFilter), enabled });
}

/**
 * Returns a function that fetches the options for a search filter on demand,
 * like a combobox does when it opens and as the user types. It shares the cache
 * with `useVariableOptionsQuery`. The function stays the same across renders and
 * always fetches with the latest props.
 */
export function useVariableOptionsLoader(
  props: VariableOptionsQueryProps,
): (searchFilter?: string) => Promise<VariableValueOption[]> {
  const queryClient = useQueryClient();
  const getQuery = useOptionsQueryDefinition(props);

  const getQueryRef = useRef(getQuery);
  useEffect(() => {
    getQueryRef.current = getQuery;
  });

  return useCallback(
    async (searchFilter?: string) => {
      const { select, ...query } = getQueryRef.current(searchFilter);
      return select(await queryClient.query(query));
    },
    [queryClient],
  );
}

/**
 * The query both hooks run, for a given search filter.
 */
function useOptionsQueryDefinition(props: VariableOptionsQueryProps) {
  const {
    datasource,
    query,
    name = 'query',
    regex = '',
    regexApplyTo = 'value',
    sort = VariableSort.disabled,
    staticOptions,
    staticOptionsOrder,
    staleTime = 30000,
  } = props;

  const requestId = useId();
  const dataSourceSrv = getDataSourceSrv();
  const timeRange = useTimeRange().value;

  const timeRangeKey = `${timeRange.from.valueOf()}-${timeRange.to.valueOf()}`;

  return (rawSearchFilter?: string) => {
    // An empty filter is the same query as no filter
    const searchFilter = rawSearchFilter || undefined;

    return {
      // Regex, sort and static options are applied in `select`, so changing them does not refetch
      queryKey: [
        'variable-options',
        datasource,
        query,
        name,
        searchFilter,
        timeRangeKey,
      ],
      staleTime,
      queryFn: async (): Promise<MetricFindValueWithProperties[]> => {
        if (!query) {
          return [];
        }

        const args: VariableQueryRunnerArgs = { name, query, searchFilter };
        const runner = createVariableQueryRunner(
          await dataSourceSrv.get(datasource),
        );

        const scopedVars: ScopedVars = {};
        if (searchFilter) {
          scopedVars.__searchFilter = {
            value: searchFilter,
            text: searchFilter,
          };
        }

        const request: DataQueryRequest = {
          app: CoreApp.Dashboard,
          requestId: `${requestId}-${Date.now()}`,
          timezone: '',
          range: timeRange,
          rangeRaw: timeRange.raw,
          interval: '',
          intervalMs: 0,
          // The runner decides the target type (string for legacy data sources)
          targets: [runner.getTarget(args) as DataQuery],
          scopedVars,
          startTime: Date.now(),
        };

        return fetchMetricFindValues(runner, args, request);
      },
      select: (values: MetricFindValueWithProperties[]) => {
        const options = metricNamesToVariableValues({
          variableRegEx: regex,
          variableRegexApplyTo: regexApplyTo,
          sort,
          metricNames: values,
        });

        return mergeStaticOptions(
          options,
          staticOptions,
          staticOptionsOrder,
          sort,
        );
      },
    };
  };
}
