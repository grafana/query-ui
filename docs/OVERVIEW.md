# Overview of Query UI

`@grafana/query-ui` is a rewrite of [Grafana Scenes](https://github.com/grafana/scenes) for building Grafana data apps with plain React components, contexts, and hooks.

## Contents

- [Why a rewrite](#why-a-rewrite)
- [Architecture](#architecture)
  - [Time range](#time-range)
  - [Variables](#variables)
  - [Querying](#querying)
  - [Visualizations and panels](#visualizations-and-panels)

## Why a rewrite

Scenes is state-first: data, variables, queries, and visualizations all live in a scene object tree outside React. That design enables serialization, state snapshots, and caching of a whole app, but most custom data apps need none of it, and they pay for it in complexity.

- **State propagation.** Variable changes, time range changes, and URL sync travel through state events and special object interfaces instead of React rendering. That's easy to unit test but leads to unconventional, hard-to-follow code.
- **State sharing.** Reading the time range or a variable means finding a scene object and subscribing to its state. A React context would cover most of these cases.
- **Transient views.** Everything has to be added to the state tree, so rendering a short-lived view is cumbersome. Caching a view also means caching its objects and sub-scenes.
- **Learning and adoption.** The unconventional mechanics give Scenes a steep learning curve and make it hard to mix with familiar React patterns like `useState` and context.
- **AI.** The same mechanics probably make it harder for LLMs to write correct Scenes app code.

This rewrite keeps the Grafana building blocks (data sources, panel plugins, variables, time range, URL sync) and puts them behind ordinary React contexts and hooks. State flows through rendering, and component-local state stays component-local.

## Architecture

An app mounts a few providers at the root. Everything below them uses hooks.

```tsx
const queryClient = new QueryClient();

<QueryClientProvider client={queryClient}>
  <UrlStateProvider>
    <TimeRangeContextProvider>
      <App />
    </TimeRangeContextProvider>
  </UrlStateProvider>
</QueryClientProvider>;
```

`UrlStateProvider` is optional. With it, the time range and variables sync to the URL.

### Time range

`TimeRangeContextProvider` holds the time range for the subtree below it. `useTimeRange()` reads it.

```tsx
<TimeRangeContextProvider initFrom="now-1h" initTo="now">
  <TimeRangeContextPicker />
  <TimeRangeRefresh />
  <Dashboard />
</TimeRangeContextProvider>
```

```tsx
function RangeLabel() {
  const { from, to, value, onChangeTimeRange, onRefresh } = useTimeRange();

  return (
    <span>
      {from} to {to}
    </span>
  );
}
```

The context value has:

| Field               | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `from`, `to`        | The raw range, for example `now-6h` and `now`.             |
| `value`             | The evaluated `TimeRange` with `DateTime` bounds.          |
| `timeZone`          | The time zone the range is evaluated in.                   |
| `refreshCounter`    | Increases on every refresh.                                |
| `onChangeTimeRange` | Sets a new range.                                          |
| `onRefresh`         | Evaluates the relative range again, which re-runs queries. |

With a `UrlStateProvider` above, the range syncs to the `from` and `to` query parameters. Nested providers sync to numbered keys (`from2`, `to2`), so an inner range never overwrites the outer one. A `cacheKey` prop remembers the range across an unmount.

### Variables

A variable is a React context that holds **one** variable: its name, value, options, and loading and error state. `DefineVariable` is the simplest one; `DataSourceVariable` loads its options from the data sources of one plugin type.

Multiple variables are nested contexts. Each provider keeps a `parent` reference to the closest variable context above it, so a lookup by name walks up the chain until it finds a match.

```tsx
<DataSourceVariable name="ds" pluginId="prometheus">
  <DefineVariable name="service" value={{ value: 'api' }}>
    <DefineVariable name="pod" value={{ value: 'api-1' }}>
      <VariableValueCombobox name="service" />
      <Panels />
    </DefineVariable>
  </DefineVariable>
</DataSourceVariable>
```

Because nesting defines scope, a variable sees only the variables above it. `DataSourceVariable` interpolates its `regex` prop against its parent, so the regex can reference variables defined above it.

`useVariable(name)` returns the variable's state and setters (`onChange`, `onOptionsChange`, `onSetLoading`, `onSetError`). Values sync to the `var-<name>` query parameter unless the variable sets `skipUrlSync`.

Give `DefineVariable` a list as its `value` (even an empty one) to make it a multi-value variable. Its value is then always a list of `VariableValue`, it syncs to one parameter per value (`?var-pod=a&var-pod=b`), and formatters join the values (`${pod:csv}` gives `a,b`).

#### Interpolation

`useInterpolator` replaces variable expressions (`$var`, `${var}`, `[[var]]`, `${var.field}`, `${var:format}`) with the values of the closest variables. It returns a tuple: the interpolated string, and a `loading` boolean that's `true` when any variable the string references is still loading.

```tsx
const [text, loading] = useInterpolator('service=$service pod=${pod}');
```

While `ds` is still loading its options, the string interpolates to the current value, and `loading` tells you not to trust it yet:

```tsx
const [uid, loading] = useInterpolator('${ds}');
```

A string that references no loading variable is never loading, even if other variables are:

Expressions that match no variable or macro stay as they are. Formats work like in Grafana dashboards:

```tsx
const [query] = useInterpolator('up{service=~"${service:regex}"}');
```

The usual pattern is to hold a query back until its variables are ready, with `enabled: !loading` (see [Querying](#querying)).

### Querying

`useDataQuery` is the main way to run data queries. It runs on [TanStack Query](https://tanstack.com/query) and needs a `QueryClientProvider` and a `TimeRangeContextProvider` above it.

```tsx
function LatencyPanel() {
  const [uid, dsLoading] = useInterpolator('${ds}');
  const [expr, exprLoading] = useInterpolator(
    'rate(http_requests_total{service="$service"}[5m])',
  );

  const { data } = useDataQuery({
    enabled: !dsLoading && !exprLoading,
    queries: [{ refId: 'A', datasource: { uid }, expr }],
    maxDataPoints: 500,
  });

  return <VizPanel title="Latency" vizConfig={timeseriesConfig} data={data} />;
}
```

It returns a TanStack `UseQueryResult<PanelData>`. The hook:

- Resolves the data source from the first query with a `datasource` ref.
- Builds the `DataQueryRequest` from the current time range, `maxDataPoints`, and `minInterval`, and sets `__interval` and `__interval_ms`.
- Re-runs when the queries, the time range, a refresh, or the ad hoc filters from `AdhocFiltersContext` change.
- Keeps showing the previous result, marked as loading, while a new query runs.
- Cancels the data source request when the query is canceled or loses its last observer.

`useDataQuery` doesn't interpolate queries itself yet. Interpolate them with `useInterpolator` first, as in the example.

### Visualizations and panels

`VizConfigBuilders` builds a `VizConfig`: a panel plugin id, options, and field config.

```tsx
const timeseriesConfig = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('fillOpacity', 30)
  .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
  .build();
```

#### VizPanel

`VizPanel` renders a panel plugin inside `PanelChrome`, with a header, loading indicator, and cancel button. It fills its parent, so give the parent a size.

```tsx
<div style={{ height: 400 }}>
  <VizPanel
    title="Requests for $service"
    description="Request rate per **pod**"
    vizConfig={timeseriesConfig}
    data={data}
    actions={<Button size="sm">Explore</Button>}
  />
</div>
```

`VizPanel` interpolates `title` and `description`, loads the panel plugin, applies option and field config defaults and overrides, and wires up the panel's interactions: zooming changes the time range, and legend toggles change the field config. Those changes are transient and last until the `vizConfig` prop changes.

#### useVizPanel

`useVizPanel` does the same work without the chrome. Use it to render a visualization on its own, inside your own layout.

```tsx
function Sparkline({ data, width, height }: SparklineProps) {
  const viz = useVizPanel({ vizConfig: sparklineConfig, data });

  if (!viz.plugin?.panel) {
    return null;
  }

  return (
    <viz.plugin.panel
      id={1}
      title=""
      data={viz.panelData}
      options={viz.panelOptions}
      fieldConfig={viz.fieldConfig}
      width={width}
      height={height}
      timeZone="browser"
      timeRange={viz.panelData.timeRange}
      transparent
      renderCounter={0}
      replaceVariables={(value) => value}
      onOptionsChange={viz.onOptionsChange}
      onFieldConfigChange={viz.onFieldConfigChange}
      onChangeTimeRange={viz.onChangeTimeRange}
      eventBus={getAppEvents()}
    />
  );
}
```
