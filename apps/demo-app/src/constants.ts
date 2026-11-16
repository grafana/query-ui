import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

export enum ROUTES {
  Home = 'home',
  PanelGridLayoutDemo = 'panel-grid-layout-demo',
  VariablesDemo = 'variables-demo',
  DataSourceVariableDemo = 'data-source-variable-demo',
  DrilldownMetrics = 'drilldown-metrics',
}

export const DATASOURCE_REF = {
  uid: 'gdev-testdata',
  type: 'testdata',
};
