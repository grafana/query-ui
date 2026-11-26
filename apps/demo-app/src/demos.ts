import { ComponentType } from 'react';
import { DataSourceVariableDemo } from 'components/DataSourceVariableDemo';
import { ManySeriesDemo } from 'components/ManySeriesDemo';
import { PanelGridLayoutDemo } from 'components/PanelGridLayoutDemo';
import { SlowQueryDemo } from 'components/SlowQueryDemo';
import { VariablesDemo } from 'components/VariablesDemo';
import { DrilldownMetrics } from 'drilldown-metrics/DrilldownMetrics';
import { TabsAndSubPagesDemo } from 'tabs-and-sub-pages/TabsAndSubPagesDemo';

export interface DemoScenario {
  /** Route path relative to the plugin base URL. The demo can add routes of its own below it. */
  route: string;
  label: string;
  component: ComponentType;
}

/**
 * Every demo the app serves. App.tsx creates a route for each entry and
 * DemoHome links to each one, so adding a demo only needs a new entry here.
 */
export const demos: DemoScenario[] = [
  { route: 'panel-grid-layout-demo', label: 'Panel grid layout demo', component: PanelGridLayoutDemo },
  { route: 'variables-demo', label: 'Variables demo', component: VariablesDemo },
  { route: 'data-source-variable-demo', label: 'Data source variable demo', component: DataSourceVariableDemo },
  { route: 'drilldown-metrics', label: 'Drilldown metrics demo', component: DrilldownMetrics },
  { route: 'slow-query-demo', label: 'Slow query demo', component: SlowQueryDemo },
  { route: 'many-series-demo', label: 'Many series demo', component: ManySeriesDemo },
  { route: 'tabs-and-sub-pages-demo', label: 'Tabs and sub pages demo', component: TabsAndSubPagesDemo },
];
