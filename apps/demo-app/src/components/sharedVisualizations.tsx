import { VizConfigBuilders } from '@grafana/scenes2';
import { GraphGradientMode, LineInterpolation } from '@grafana/ui';
import { VisibilityMode } from '@grafana/schema';

export const plainTimeSeriesGraph = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('fillOpacity', 30)
  .setCustomFieldConfig('gradientMode', GraphGradientMode.Opacity)
  .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
  .setCustomFieldConfig('showPoints', VisibilityMode.Never)
  .build();
