import { lazy } from 'react';
import { AppPlugin } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import { loadTranslations } from '@grafana/query-ui';
import pluginJson from 'plugin.json';

await initPluginTranslations(pluginJson.id, [loadTranslations]);

const App = lazy(() => import('./App'));

export const plugin = new AppPlugin<{}>().setRootPage(App);
