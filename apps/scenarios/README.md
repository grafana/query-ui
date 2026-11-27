# @grafana/scenarios

Standalone web app for building scenarios on top of `@grafana/query-ui`. Vite +
React 19, routed with react-router 6, styled through the Grafana theme from
`@grafana/ui`.

## Scripts

```bash
pnpm --filter @grafana/scenarios dev        # Dev server with HMR on http://localhost:5273
pnpm --filter @grafana/scenarios build      # Type-check, then production build to dist/
pnpm --filter @grafana/scenarios preview    # Serve the production build
pnpm --filter @grafana/scenarios typecheck  # tsc -b
pnpm --filter @grafana/scenarios lint       # eslint (root flat config)
pnpm --filter @grafana/scenarios e2e        # Playwright end-to-end tests
```

`pnpm e2e` starts the dev server itself, so it needs no build step. It does need
the browser binaries once per machine:

```bash
pnpm --filter @grafana/scenarios exec playwright install chromium
```

## How it fits together

`vite.config.ts` aliases `@grafana/query-ui` to `packages/query-ui/src/index.ts`,
so editing the workspace package hot-reloads here instead of needing a rebuild.
Type-checking still resolves the package through its built `dist/` types, which
turbo builds first — that keeps the app honest about the package's public API.

`index.html` seeds `window.grafanaBootData` before any module runs.
`@grafana/runtime` reads it at module-evaluation time to build `config`, and
`src/providers/ThemeProvider.tsx` hands `config.theme2` to `ThemeContext` so the
React context and the runtime config always agree. Change `user.theme` in that
seed to switch between `dark` and `light`.

### Faking @grafana/runtime services

`VizPanel` and `useDataQuery` (both from `@grafana/query-ui`) don't call a
backend directly — they read `getDataSourceSrv()`, `getRunRequest()` and
`getPluginImportUtils()` off `@grafana/runtime`. In a real Grafana instance
those are registered once, on boot, by `GrafanaApp.init()` in
`public/app/app.ts`. This app has no Grafana backend, so `src/grafana/`
registers fakes for the same three services, and `src/main.tsx` calls
`initFakeGrafanaRuntime()` before rendering, the same way `app.ts` calls
`init()` before its first render:

- `FakeRandomWalkDataSource` (`FakeRandomWalkDataSource.ts`) extends
  `DataSourceApi` and synthesizes a random-walk series in the browser —
  no backend, no `/api/ds/query` call. It stands in for the testdata
  datasource's `random_walk` scenario that `apps/demo-app` queries against.
  A query's `delayMs` holds the response back to stand in for a slow query;
  unsubscribing before then cancels it. `fakeQueryStats.ts` counts how each
  query ended, which `/slow-query-demo` shows and its e2e test reads.
- `runFakeRequest` (`fakeRunRequest.ts`) stands in for
  `public/app/features/query/state/runRequest.ts`: it calls the datasource
  and turns the response into `PanelData`, skipping the mixed-datasource and
  retry handling the real one adds.
- `fakeTimeSeriesPanelPlugin` (`FakeTimeSeriesPanel.tsx`) is a `PanelPlugin`
  wrapping an inline-SVG sparkline, standing in for a real panel plugin like
  the built-in timeseries panel — which loads via SystemJS in a real Grafana
  instance and isn't reachable from this Vite app.

`src/pages/PanelGridLayoutDemoPage.tsx` exercises all three: it's the Vite-app
equivalent of `apps/demo-app`'s `PanelGridLayoutDemo`, with the same
`QueryClientProvider` + `UrlStateProvider` + `TimeRangeContextProvider`
nesting, querying the fake data source and rendering through the fake panel.

### Fonts and icons

`GlobalStyles` and `Icon` from `@grafana/ui` request static assets from
`<public path>fonts/…` and `<public path>build/img/icons/…`, where the public
path is `window.__grafana_public_path__`. `index.html` sets it to `/public/`,
as Grafana does on boot. Without it, the path falls back to a relative
`public/`, which resolves under the current route and breaks on any page more
than one segment deep.
`public/public/fonts/` and `public/public/build/img/icons/` vendor the Inter and
Roboto Mono woff2 files and the full icon set from
[grafana/grafana](https://github.com/grafana/grafana/tree/main/public), so both
resolve against Vite's own static file serving.

### Known gaps

React Router 6 logs two `v7_*` future-flag warnings. Passing
`future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` to
`BrowserRouter` silences them and opts into v7 routing behavior early.
