import {
  filter,
  from,
  lastValueFrom,
  mergeMap,
  type Observable,
  of,
  take,
} from 'rxjs';
import {
  type DataQuery,
  type DataQueryRequest,
  type DataSourceApi,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  type StandardVariableQuery,
} from '@grafana/data';
import { getRunRequest } from '@grafana/runtime';

import {
  hasCustomVariableSupport,
  hasDataSourceVariableSupport,
  hasLegacyVariableSupport,
  hasStandardVariableSupport,
} from './guards';
import {
  type MetricFindValueWithProperties,
  toMetricFindValues,
} from './toMetricFindValues';

type RunRequest = ReturnType<typeof getRunRequest>;

export interface VariableQueryRunnerArgs {
  /** Variable name. Used for default refIds and sent to legacy data sources. */
  name: string;
  query: string | DataQuery;
  searchFilter?: string;
}

/**
 * Hides the differences between the four ways a data source can support variable queries
 * (standard, legacy, custom and data source).
 */
export interface VariableQueryRunner {
  getTarget: (args: VariableQueryRunnerArgs) => DataQuery | string;
  runRequest: (
    args: VariableQueryRunnerArgs,
    request: DataQueryRequest,
  ) => Observable<PanelData>;
}

class StandardQueryRunner implements VariableQueryRunner {
  public constructor(
    private datasource: DataSourceApi,
    private _runRequest: RunRequest,
  ) {}

  public getTarget(args: VariableQueryRunnerArgs) {
    if (hasStandardVariableSupport(this.datasource)) {
      return this.datasource.variables.toDataQuery(
        ensureVariableQueryModelIsADataQuery(args),
      );
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  public runRequest(_: VariableQueryRunnerArgs, request: DataQueryRequest) {
    if (!hasStandardVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!this.datasource.variables.query) {
      return this._runRequest(this.datasource, request);
    }

    return this._runRequest(
      this.datasource,
      request,
      this.datasource.variables.query.bind(this.datasource.variables),
    );
  }
}

class LegacyQueryRunner implements VariableQueryRunner {
  public constructor(private datasource: DataSourceApi) {}

  public getTarget({ query }: VariableQueryRunnerArgs) {
    if (hasLegacyVariableSupport(this.datasource)) {
      return query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  public runRequest(
    { name, query, searchFilter }: VariableQueryRunnerArgs,
    request: DataQueryRequest,
  ) {
    if (!hasLegacyVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    return from(
      this.datasource.metricFindQuery(query, {
        ...request,
        // variable is used by SQL common data source
        variable: { name, type: 'query' },
        searchFilter,
      }),
    ).pipe(
      mergeMap((values) => {
        if (!values || !values.length) {
          return getEmptyMetricFindValueObservable();
        }

        // Legacy data sources return MetricFindValue[], which toMetricFindValues accepts as series
        const series = values as unknown as PanelData['series'];
        return of<PanelData>({
          series,
          state: LoadingState.Done,
          timeRange: request.range,
        });
      }),
    );
  }
}

class CustomQueryRunner implements VariableQueryRunner {
  public constructor(
    private datasource: DataSourceApi,
    private _runRequest: RunRequest,
  ) {}

  public getTarget({ query }: VariableQueryRunnerArgs) {
    if (hasCustomVariableSupport(this.datasource)) {
      return query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  public runRequest(_: VariableQueryRunnerArgs, request: DataQueryRequest) {
    if (!hasCustomVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!this.datasource.variables.query) {
      return this._runRequest(this.datasource, request);
    }

    return this._runRequest(
      this.datasource,
      request,
      this.datasource.variables.query.bind(this.datasource.variables),
    );
  }
}

const variableDummyRefId = 'variable-query';

class DatasourceQueryRunner implements VariableQueryRunner {
  public constructor(
    private datasource: DataSourceApi,
    private _runRequest: RunRequest,
  ) {}

  public getTarget({ query }: VariableQueryRunnerArgs) {
    if (hasDataSourceVariableSupport(this.datasource)) {
      if (typeof query === 'string') {
        return query;
      }

      return { ...query, refId: query.refId ?? variableDummyRefId };
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  public runRequest(_: VariableQueryRunnerArgs, request: DataQueryRequest) {
    if (!hasDataSourceVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    return this._runRequest(this.datasource, request);
  }
}

function getEmptyMetricFindValueObservable(): Observable<PanelData> {
  return of({
    state: LoadingState.Done,
    series: [],
    timeRange: getDefaultTimeRange(),
  });
}

/**
 * Picks a runner based on the kind of variable support the data source implements.
 */
export function createVariableQueryRunner(
  datasource: DataSourceApi,
  runRequest: RunRequest = getRunRequest(),
): VariableQueryRunner {
  if (hasStandardVariableSupport(datasource)) {
    return new StandardQueryRunner(datasource, runRequest);
  }

  if (hasLegacyVariableSupport(datasource)) {
    return new LegacyQueryRunner(datasource);
  }

  if (hasCustomVariableSupport(datasource)) {
    return new CustomQueryRunner(datasource, runRequest);
  }

  if (hasDataSourceVariableSupport(datasource)) {
    return new DatasourceQueryRunner(datasource, runRequest);
  }

  throw new Error(
    `Couldn't create a query runner for datasource ${datasource.type}`,
  );
}

/**
 * Runs the variable query and resolves with the values of the first finished response.
 * Rejects with an Error when the response is in an error state.
 */
export async function fetchMetricFindValues(
  runner: VariableQueryRunner,
  args: VariableQueryRunnerArgs,
  request: DataQueryRequest,
): Promise<MetricFindValueWithProperties[]> {
  const data = await lastValueFrom(
    runner.runRequest(args, request).pipe(
      filter(
        (data) =>
          data.state === LoadingState.Done || data.state === LoadingState.Error,
      ),
      take(1),
    ),
  );

  if (data.state === LoadingState.Error) {
    // `error` is unset when the backend only populated `errors`
    throw toError(data.error ?? data.errors?.[0]);
  }

  return toMetricFindValues(data);
}

function toError(source: unknown): Error {
  if (source instanceof Error) {
    return source;
  }

  if (source && typeof source === 'object') {
    const { message, data } = source as {
      message?: string;
      data?: { message?: string };
    };
    const text = message ?? data?.message;

    if (text) {
      return new Error(text);
    }
  }

  return new Error('Variable query failed');
}

/**
 * Fixes old legacy query string models and adds refId if missing
 */
function ensureVariableQueryModelIsADataQuery({
  name,
  query,
}: VariableQueryRunnerArgs): StandardVariableQuery {
  // Turn into query object if it's just a string
  if (typeof query === 'string') {
    return { query, refId: `variable-${name}` };
  }

  // Add potentially missing refId
  if (query.refId == null) {
    return { ...query, refId: `variable-${name}` } as StandardVariableQuery;
  }

  return query as StandardVariableQuery;
}
