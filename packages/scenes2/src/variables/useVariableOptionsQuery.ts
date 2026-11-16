import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useId } from 'react';
import {
  CoreApp,
  type DataQuery,
  type DataQueryRequest,
  type ScopedVars,
  VariableSort,
  type VariableRegexApplyTo,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { useTimeRange } from '../hooks/useTimeRange';
import {
  createVariableQueryRunner,
  fetchMetricFindValues,
  type VariableQueryRunnerArgs,
} from './query/createVariableQueryRunner';
import type { MetricFindValueWithProperties } from './query/toMetricFindValues';
import {
  mergeStaticOptions,
  metricNamesToVariableValues,
  type StaticOptionsOrder,
} from './query/utils';
import type { VariableValueOption } from './types';

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
  const {
    enabled = true,
    datasource,
    query,
    name = 'query',
    regex = '',
    regexApplyTo = 'value',
    sort = VariableSort.disabled,
    staticOptions,
    staticOptionsOrder,
    searchFilter,
    staleTime = 30000,
  } = props;

  const requestId = useId();
  const dataSourceSrv = getDataSourceSrv();
  const timeRange = useTimeRange().value;

  const timeRangeKey = `${timeRange.from.valueOf()}-${timeRange.to.valueOf()}`;

  return useQuery<
    MetricFindValueWithProperties[],
    Error,
    VariableValueOption[]
  >({
    // Regex, sort and static options are applied in `select`, so changing them does not refetch
    queryKey: [
      'variable-options',
      datasource,
      query,
      name,
      searchFilter,
      timeRangeKey,
    ],
    enabled,
    staleTime,
    queryFn: async () => {
      if (!query) {
        return [];
      }

      const args: VariableQueryRunnerArgs = { name, query, searchFilter };
      const runner = createVariableQueryRunner(
        await dataSourceSrv.get(datasource),
      );

      const scopedVars: ScopedVars = {};
      if (searchFilter) {
        scopedVars.__searchFilter = { value: searchFilter, text: searchFilter };
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
    select: (values) => {
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
  });
}
