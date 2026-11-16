import { useDataQuery } from '@grafana/scenes2';

import { getMetricQuery } from './getMetricQuery';

/** Runs the PromQL query that {@link getMetricQuery} picks for the metric. */
export function useMetricData(metric: string, dsUid: string) {
  return useDataQuery({
    queries: [
      {
        refId: 'A',
        datasource: { uid: dsUid },
        expr: getMetricQuery(metric),
      },
    ],
    maxDataPoints: 100,
  });
}
