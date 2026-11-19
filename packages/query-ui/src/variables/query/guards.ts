import type { ComponentType } from 'react';
import type { Observable } from 'rxjs';
import {
  type DataQuery,
  type DataSourceJsonData,
  type DataSourceApi,
  type MetricFindValue,
  VariableSupportType,
  type StandardVariableQuery,
  type DataQueryRequest,
  type DataQueryResponse,
  type QueryEditorProps,
} from '@grafana/data';
import type { TemplateSrv } from '@grafana/runtime';

/**
 * Interfaces and guards below are copied from core.
 * Not exposing via grafana/data as these are not intended to be used in context other than variables.
 */

interface DataSourceWithLegacyVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> extends DataSourceApi<TQuery, TOptions> {
  metricFindQuery(
    query: unknown,
    options?: unknown,
  ): Promise<MetricFindValue[]>;
  variables: undefined;
}

interface DataSourceWithStandardVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    getType(): VariableSupportType;
    toDataQuery(query: StandardVariableQuery): TQuery;
    query(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse>;
  };
}

interface DataSourceWithCustomVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    getType(): VariableSupportType;
    editor: VariableQueryEditorType;
    query(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse>;
  };
}

interface VariableQueryEditorProps {
  query: unknown;
  onChange: (query: unknown, definition: string) => void;
  datasource: unknown;
  templateSrv: TemplateSrv;
}

type VariableQueryEditorType<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> =
  | ComponentType<VariableQueryEditorProps>
  | ComponentType<
      QueryEditorProps<
        DataSourceApi<TQuery, TOptions>,
        TQuery,
        TOptions,
        DataQuery
      >
    >
  | null;

export const hasLegacyVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
>(
  datasource: DataSourceApi<TQuery, TOptions>,
): datasource is DataSourceWithLegacyVariableSupport<TQuery, TOptions> => {
  return Boolean(datasource.metricFindQuery) && !datasource.variables;
};

export const hasStandardVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
>(
  datasource: DataSourceApi<TQuery, TOptions>,
): datasource is DataSourceWithStandardVariableSupport<TQuery, TOptions> => {
  if (!datasource.variables) {
    return false;
  }

  if (datasource.variables.getType() !== VariableSupportType.Standard) {
    return false;
  }

  const variableSupport = datasource.variables;
  return (
    'toDataQuery' in variableSupport && Boolean(variableSupport.toDataQuery)
  );
};

export const hasCustomVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
>(
  datasource: DataSourceApi<TQuery, TOptions>,
): datasource is DataSourceWithCustomVariableSupport<TQuery, TOptions> => {
  if (!datasource.variables) {
    return false;
  }

  if (datasource.variables.getType() !== VariableSupportType.Custom) {
    return false;
  }

  const variableSupport = datasource.variables;
  return (
    'query' in variableSupport &&
    'editor' in variableSupport &&
    Boolean(variableSupport.query) &&
    Boolean(variableSupport.editor)
  );
};

export const hasDataSourceVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
>(
  datasource: DataSourceApi<TQuery, TOptions>,
): datasource is DataSourceWithCustomVariableSupport<TQuery, TOptions> => {
  if (!datasource.variables) {
    return false;
  }

  return datasource.variables.getType() === VariableSupportType.Datasource;
};
