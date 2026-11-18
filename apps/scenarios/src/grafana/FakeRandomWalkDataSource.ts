import { map, type Observable, of, timer } from 'rxjs';
import {
  createDataFrame,
  type DataFrame,
  type DataQuery,
  type DataQueryRequest,
  type DataQueryResponse,
  DataSourceApi,
  type DataSourceInstanceSettings,
  FieldType,
  type TestDataSourceResponse,
} from '@grafana/data';

import { trackQuery } from './fakeQueryStats';

export interface FakeRandomWalkQuery extends DataQuery {
  alias?: string;
  /**
   * Holds the response back this long, in milliseconds, to stand in for a slow
   * query. Unsubscribing before then cancels it. A request waits for its
   * slowest query.
   */
  delayMs?: number;
  /** Returns this many series instead of one, like the testdata data source. */
  seriesCount?: number;
}

/**
 * Synthesizes a random-walk series entirely in the browser, so VizPanel and
 * useDataQuery have a real DataSourceApi to query without a Grafana backend.
 * Mirrors the shape of the testdata datasource's "random_walk" scenario that
 * apps/demo-app's PanelGridLayoutDemo queries against.
 */
export class FakeRandomWalkDataSource extends DataSourceApi<FakeRandomWalkQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(
    request: DataQueryRequest<FakeRandomWalkQuery>,
  ): Observable<DataQueryResponse> {
    const { range, targets, maxDataPoints = 100 } = request;
    const from = range.from.valueOf();
    const to = range.to.valueOf();
    const stepMs = Math.max(1000, Math.floor((to - from) / maxDataPoints));
    const delayMs = Math.max(0, ...targets.map((t) => t.delayMs ?? 0));

    const response = (): DataQueryResponse => ({
      data: targets.flatMap((target) => {
        const seriesCount = target.seriesCount ?? 1;
        const baseName = target.alias ?? target.refId;

        return Array.from({ length: seriesCount }, (_, i) =>
          buildRandomWalkFrame(
            target.refId,
            // A single series keeps the plain name the other demos expect
            seriesCount === 1 ? baseName : `${baseName}-series-${i + 1}`,
            from,
            to,
            stepMs,
          ),
        );
      }),
    });

    // A timer stops when it is unsubscribed, the way a canceled fetch would.
    const source = delayMs > 0 ? timer(delayMs) : of(0);

    return trackQuery(source.pipe(map(response)));
  }

  async testDatasource(): Promise<TestDataSourceResponse> {
    return {
      status: 'success',
      message: 'Fake random walk data source is working',
    };
  }
}

function buildRandomWalkFrame(
  refId: string,
  name: string,
  from: number,
  to: number,
  stepMs: number,
): DataFrame {
  const times: number[] = [];
  const values: number[] = [];
  let value = Math.random() * 100;

  for (let time = from; time <= to; time += stepMs) {
    value += Math.random() * 10 - 5;
    times.push(time);
    values.push(value);
  }

  return createDataFrame({
    refId,
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
