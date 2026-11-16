/**
 * Picks a reasonable PromQL expression for a metric based on Prometheus naming conventions.
 */
export function getMetricQuery(metric: string): string {
  if (metric.endsWith('_bucket')) {
    return `histogram_quantile(0.95, sum by (le) (rate(${metric}[$__rate_interval])))`;
  }

  if (metric.endsWith('_total') || metric.endsWith('_count') || metric.endsWith('_sum')) {
    return `sum(rate(${metric}[$__rate_interval]))`;
  }

  return `avg(${metric})`;
}
