import {
  createDataFrame,
  type DataFrame,
  type DataQuery,
  type DataQueryRequest,
  type DataQueryResponse,
  DataSourceApi,
  type DataSourceGetTagKeysOptions,
  type DataSourceGetTagValuesOptions,
  type DataSourceInstanceSettings,
  FieldType,
  type MetricFindValue,
  type TestDataSourceResponse,
} from '@grafana/data';

import { recordValue } from '../renderStats/renderStats';

export interface FakeLabeledQuery extends DataQuery {
  alias?: string;
  /** Names the series when there is no alias. Not evaluated. */
  expr?: string;
}

/** The labels the fake series carry, each with its values. */
const LabelIndex: Record<string, string[]> = {
  service: ['checkout', 'cart', 'auth'],
  env: ['prod', 'staging', 'dev'],
  region: ['us-east', 'us-west', 'eu'],
};

/**
 * The pods running in each env, for queries that narrow label values down with
 * matchers. Every env has its own apps and every app its own pods, so changing
 * one always changes the options of the ones below it.
 */
const Deployments: Array<Record<string, string>> = LabelIndex.env.flatMap(
  (env) =>
    ['api', 'web'].flatMap((service) =>
      [0, 1].map((index) => ({
        env,
        app: `${env}-${service}`,
        pod: `${env}-${service}-${index}`,
      })),
    ),
);

/**
 * Synthesizes a random-walk series like FakeRandomWalkDataSource, but also
 * implements getTagKeys/getTagValues against a fixed label set, and folds
 * the active adhoc filters into the series name - enough to drive and
 * visually verify the AdHocFiltersCombobox scenario without a real backend.
 */
export class FakeLabeledDataSource extends DataSourceApi<FakeLabeledQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  async query(
    request: DataQueryRequest<FakeLabeledQuery>,
  ): Promise<DataQueryResponse> {
    const { range, targets, maxDataPoints = 100, filters } = request;
    const from = range.from.valueOf();
    const to = range.to.valueOf();
    const stepMs = Math.max(1000, Math.floor((to - from) / maxDataPoints));
    const filterSuffix = filters?.length
      ? ` (${filters.map((f) => `${f.key}${f.operator}${f.values?.join('|') ?? f.value}`).join(', ')})`
      : '';

    for (const target of targets) {
      recordValue(
        'DataSourceApi.query',
        target.expr ?? target.alias ?? target.refId,
      );
    }

    return {
      data: targets.map((target) =>
        buildFrame(target, from, to, stepMs, filterSuffix),
      ),
    };
  }

  async getTagKeys(
    _options: DataSourceGetTagKeysOptions<FakeLabeledQuery>,
  ): Promise<MetricFindValue[]> {
    return Object.keys(LabelIndex).map((key) => ({ text: key }));
  }

  async getTagValues(
    options: DataSourceGetTagValuesOptions<FakeLabeledQuery>,
  ): Promise<MetricFindValue[]> {
    return (LabelIndex[options.key] ?? []).map((value) => ({ text: value }));
  }

  /**
   * Variable query (legacy variable support): the query is `labels()` for the
   * label names, `labelValues(<label>)` for the values of one label, or
   * `labelValues(<label>=<value>, ..., <label>)` for the values of a label on
   * the pods that match all the matchers. The
   * result is narrowed to the ones containing the search filter, and any other
   * query returns nothing. A short delay makes the loading state visible.
   */
  async metricFindQuery(
    query: string,
    options?: { searchFilter?: string },
  ): Promise<MetricFindValue[]> {
    recordValue('DataSourceApi.metricFindQuery', query);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const search = options?.searchFilter?.toLowerCase() ?? '';

    return findLabelValues(query)
      .filter((value) => value.toLowerCase().includes(search))
      .map((value) => ({ text: value }));
  }

  async testDatasource(): Promise<TestDataSourceResponse> {
    return {
      status: 'success',
      message: 'Fake labeled data source is working',
    };
  }
}

const LABEL_VALUES_QUERY = /^labelValues\((?:(.*),\s*)?(\w+)\)$/;

function findLabelValues(query: string): string[] {
  if (query === 'labels()') {
    return Object.keys(LabelIndex);
  }

  const match = LABEL_VALUES_QUERY.exec(query);

  if (!match) {
    return [];
  }

  const [, matchers, label] = match;

  if (!matchers) {
    return LabelIndex[label] ?? distinctValues(Deployments, label);
  }

  // `env=prod, app=prod-api`. An empty value matches nothing.
  const pairs = matchers.split(',').map((matcher) => {
    const [key, value = ''] = matcher.split('=').map((part) => part.trim());
    return [key, value] as const;
  });
  const matching = Deployments.filter((deployment) =>
    pairs.every(([key, value]) => deployment[key] === value),
  );

  return distinctValues(matching, label);
}

function distinctValues(
  series: Array<Record<string, string>>,
  label: string,
): string[] {
  return [...new Set(series.map((labels) => labels[label]).filter(Boolean))];
}

function buildFrame(
  target: FakeLabeledQuery,
  from: number,
  to: number,
  stepMs: number,
  filterSuffix: string,
): DataFrame {
  const times: number[] = [];
  const values: number[] = [];
  let value = Math.random() * 100;

  for (let time = from; time <= to; time += stepMs) {
    value += Math.random() * 10 - 5;
    times.push(time);
    values.push(value);
  }

  const name = (target.alias ?? target.expr ?? target.refId) + filterSuffix;

  return createDataFrame({
    refId: target.refId,
    name,
    fields: [
      { name: 'Time', type: FieldType.time, values: times },
      {
        name: 'Value',
        type: FieldType.number,
        values,
        config: { displayName: name },
      },
    ],
  });
}
