# Migrating from Scenes

This guide maps [Grafana Scenes](https://grafana.com/developers/scenes) code to `@grafana/query-ui` and plain react-router. It's for developers and coding agents porting a Scenes app. Read [OVERVIEW.md](OVERVIEW.md) first for how the query-ui providers and hooks work.

For a working example, see `apps/demo-app/src/tabs-and-sub-pages/`. It ports a simplified version of the Scenes [monitoring app](https://github.com/grafana/scenes/blob/main/packages/scenes-app/src/monitoring-app/GrafanaMonitoringApp.tsx): two tabs, a table, and a drilldown page.

This replaces `SceneApp` as the top-level component. The demo app's root is `apps/demo-app/src/App.tsx`.

## Concept map

Scene objects become React components, contexts, and hooks. State lives in React and the URL, not in an object tree.

| Scenes                                    | query-ui                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `SceneTimeRange`                          | `TimeRangeContextProvider` (once, at the app root)                        |
| URL sync (`UrlSyncContextProvider`)       | `UrlStateProvider` (once, at the app root)                                |
| `SceneVariableSet` + `DataSourceVariable` | `<DataSourceVariable name pluginId>`, nested around the pages that use it |
| `CustomVariable` / `ConstantVariable`     | `<DefineVariable>`                                                        |
| `QueryVariable`                           | `<QueryVariable>`                                                         |
| `AdHocFiltersVariable`                    | `<AdhocFiltersProvider datasource>`                                       |
| `VariableValueSelectors`                  | `<VariableValueCombobox name>`, `<AdHocFiltersCombobox>`                  |
| `SceneTimePicker`, `SceneRefreshPicker`   | `<TimeRangeContextPicker>`, `<TimeRangeRefresh>`                          |
| `SceneQueryRunner` (`$data`)              | `useDataQuery()`                                                          |
| `PanelBuilders.stat()` …`.build()`        | `VizConfigBuilders.stat()` …`.build()` + `<VizPanel>`                     |
| `SceneFlexLayout`, `SceneCSSGridLayout`   | `<GridPanelLayout>`                                                       |
| `sceneGraph.interpolate()`                | `useInterpolator()`                                                       |
| `sceneGraph.getTimeRange()`               | `useTimeRange()`                                                          |
| `SceneApp` + `SceneAppPage`               | react-router `<Routes>` + `PluginPage` from `@grafana/runtime`            |
| `SceneAppPage` `tabs`                     | sibling routes, rendered as `pageNav.children`                            |
| `SceneAppPage` `drilldowns`               | a route with a param, read with `useParams()`                             |
| `getParentPage` (breadcrumbs)             | `pageNav.parentItem`                                                      |
| `preserveUrlKeys`                         | handle it yourself for now                                                |

## App root

Mount three providers once, around the app's routes. `QueryClientProvider` gives `useDataQuery` its TanStack Query client and cache, `UrlStateProvider` syncs state to the URL (this is optional), and `TimeRangeContextProvider` holds the time range every query uses.

```tsx
import { Route, Routes } from 'react-router-dom';
import { TimeRangeContextProvider, UrlStateProvider } from '@grafana/query-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Created once, outside the component, so the query cache survives re-renders.
const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UrlStateProvider>
        <TimeRangeContextProvider>
          <Routes>
            <Route path="monitoring/*" element={<MonitoringApp />} />
          </Routes>
        </TimeRangeContextProvider>
      </UrlStateProvider>
    </QueryClientProvider>
  );
}
```

## Queries and panels

Scenes attaches a query runner to a panel:

```ts
PanelBuilders.stat()
  .setTitle('Requests / s')
  .setUnit('reqps')
  .setData(
    new SceneQueryRunner({
      datasource: { uid: '$ds' },
      queries: [{ refId: 'A' }],
    }),
  )
  .build();
```

In query-ui, a component runs the query and passes the result to `VizPanel`. The title and data move from the builder to `VizPanel` props.

```tsx
const statConfig = VizConfigBuilders.stat().setUnit('reqps').build();

function RequestsStat() {
  const [uid, dsLoading] = useInterpolator('$ds');
  const { data } = useDataQuery({
    enabled: !dsLoading,
    queries: [{ refId: 'A', datasource: { uid } }],
  });

  return <VizPanel title="Requests / s" vizConfig={statConfig} data={data} />;
}
```

`useDataQuery` doesn't interpolate queries, so run every string with a variable through `useInterpolator` and hold the query with `enabled` until it stops loading. To share one result between panels, as a shared `$data` does in Scenes, call the hook in a parent and pass `data` down.

## Variables and controls

Scenes declares variables on the scene and renders them in `controls`. In query-ui, variables are providers and their pickers go anywhere below them:

```tsx
<DataSourceVariable name="ds" pluginId="grafana-testdata-datasource">
  <AdhocFiltersProvider datasource={{ uid: '$ds' }}>
    <VariableValueCombobox name="ds" />
    <AdHocFiltersCombobox />
    <Panels />
  </AdhocFiltersProvider>
</DataSourceVariable>
```

`AdhocFiltersProvider` interpolates its own `datasource`, so `$ds` works there. `useDataQuery` applies the filters from the closest provider.

## SceneApp to react-router

A `SceneAppPage` with tabs and drilldowns becomes plain routes. Mount the variables above `<Routes>` so every page shares them:

```tsx
// In the app root: <Route path="tabs-and-sub-pages-demo/*" element={<Demo />} />
function Demo() {
  return (
    <DataSourceVariable name="ds" pluginId="grafana-testdata-datasource">
      <Routes>
        <Route path="overview" element={<OverviewTab />} />
        <Route path="http-handlers" element={<HttpHandlersTab />} />
        <Route path="http-handlers/:handler" element={<HttpHandlerPage />} />
      </Routes>
    </DataSourceVariable>
  );
}
```

Each page renders `PluginPage` with a `pageNav`. Grafana draws `children` as tabs under the title, and `parentItem` chains as breadcrumbs:

```tsx
// A tab page
<PluginPage
  pageNav={{
    text: 'Tabs and sub pages demo',
    url: linkTo(paths.overview),
    children: tabs.map((tab) => ({ text: tab.text, url: linkTo(tab.path), active: pathname === tab.path })),
  }}
  actions={<TimeRangeContextPicker />}
>

// A drilldown page
const { handler } = useParams();
<PluginPage pageNav={{ text: handler, parentItem: { text: 'HTTP handlers', url: linkTo(paths.httpHandlers) } }}>
```

Encode route params that can hold slashes (`encodeURIComponent('/api/ds/query')`). `useParams` decodes them.

## URL state

Scenes keeps the time range and variables across pages with `preserveUrlKeys`. In query-ui, a link to a bare path resets them, because each provider falls back to its default when its URL key is missing. Carry the current query string on every link, tab, breadcrumb, and redirect:

```ts
function useLinkWithUrlState() {
  const { search } = useLocation();
  return useCallback((pathname: string) => `${pathname}${search}`, [search]);
}

<Navigate to={{ pathname: paths.overview, search }} replace />;
```

This carries every key, including ones only the current page uses. Filter `search` if a page-local key shouldn't follow the user.
