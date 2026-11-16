import { useInterpolator, VizPanel } from '@grafana/scenes2';

import { plainTimeSeriesGraph } from '../components/sharedVisualizations';
import { useMetricData } from './useMetricData';

interface MetricSceneProps {
  metric: string;
}

/** The view for a single selected metric. */
export function MetricScene({ metric }: MetricSceneProps) {
  const [ds] = useInterpolator('${ds}');
  const data = useMetricData(metric, ds);

  return (
    <div style={{ height: 400 }}>
      <VizPanel title={metric} vizConfig={plainTimeSeriesGraph} data={data.data} />
    </div>
  );
}
