import { expect, type Page, test } from '@playwright/test';

// Runs against /cascading-variables-demo, which nests three query variables on
// FakeLabeledDataSource, each narrowed down by the ones above it:
//   env: `labelValues(env)`                    prod, staging, dev
//   app: `labelValues(env=$env, app)`          <env>-api, <env>-web
//   pod: `labelValues(env=$env, app=$app, pod)` <app>-0, <app>-1
// Every env has its own apps and every app its own pods, so a change to env
// has to change app, and that has to change pod.
//
// Inside all three, probes count the commits of a component calling
// useInterpolator, of one calling useDataQuery, and of the VizPanel it feeds
// (through a React Profiler). They also record each value the hooks return,
// and the fake data source records each variable and data query it receives.
// The page exposes all of it as `window.__renderStats`.

/** What `window.__renderStats.snapshot()` returns. */
interface RenderStats {
  renders: Record<string, number>;
  values: Record<string, string[]>;
  lastActivity: number;
}

declare global {
  interface Window {
    __renderStats?: { snapshot(): RenderStats; reset(): void };
  }
}

function combobox(page: Page, name: string) {
  return page.getByRole('combobox', { name, exact: true });
}

function interpolated(page: Page) {
  return page.getByTestId('interpolated');
}

/** The series the data query returned, once it's done fetching. */
function dataQuery(page: Page) {
  return page.getByTestId('data-query');
}

function expr(env: string, app: string, pod: string) {
  return `requests{env="${env}", app="${app}", pod="${pod}"}`;
}

/** Waits until no probe has recorded anything for `quietMs`. */
async function waitForQuiet(page: Page, quietMs = 500) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            performance.now() - window.__renderStats!.snapshot().lastActivity,
        ),
      { intervals: [100] },
    )
    .toBeGreaterThan(quietMs);
}

function resetStats(page: Page) {
  return page.evaluate(() => window.__renderStats!.reset());
}

async function readStats(page: Page) {
  const stats = await page.evaluate(() => window.__renderStats!.snapshot());
  const { renders, values } = stats;

  // In the HTML report, so the numbers can be read off a passing run too
  await test.info().attach('render-stats.json', {
    body: JSON.stringify({ renders, values }, null, 2),
    contentType: 'application/json',
  });

  // Nested updates (`VizPanel nested-update`) depend on timing, so they are
  // in the report but left out here
  const commits = {
    useInterpolator: renders.useInterpolator ?? 0,
    useDataQuery: renders.useDataQuery ?? 0,
    VizPanel: renders.VizPanel ?? 0,
  };

  return { commits, values };
}

// The values in the URL are trusted, so the page starts without querying.
async function gotoProd(page: Page) {
  await page.goto(
    '/cascading-variables-demo?var-env=prod&var-app=prod-api&var-pod=prod-api-0',
  );

  await expect(interpolated(page)).toHaveText(
    'env=prod app=prod-api pod=prod-api-0',
  );
  await expect(dataQuery(page)).toHaveText(
    expr('prod', 'prod-api', 'prod-api-0'),
  );
  await waitForQuiet(page);
}

/** Opens a variable's combobox and waits for its options to load. */
async function openCombobox(page: Page, name: string, options: string[]) {
  await combobox(page, name).click();
  await expect(page.getByRole('option')).toHaveText(options);
  await waitForQuiet(page);
}

// The numbers below are what the cascade costs today. They are exact on
// purpose: a change that adds or saves a commit or a query fails here, so
// update them when the change is intended. Each run attaches the full stats
// to the HTML report as render-stats.json.
test.describe('cascading query variables', () => {
  test('a change to env cascades through app and pod', async ({ page }) => {
    await gotoProd(page);
    await openCombobox(page, 'env', ['prod', 'staging', 'dev']);

    // Counted from the selection on, so mounting and opening don't count
    await resetStats(page);
    await page.getByRole('option', { name: 'staging', exact: true }).click();

    await expect(interpolated(page)).toHaveText(
      'env=staging app=staging-api pod=staging-api-0',
    );
    await expect(dataQuery(page)).toHaveText(
      expr('staging', 'staging-api', 'staging-api-0'),
    );
    await waitForQuiet(page);

    const { commits, values } = await readStats(page);

    // App and pod are loading from the commit env changes in, so neither the
    // pod query nor the data query goes out with app and pod still on prod
    expect(values['variable query']).toEqual([
      'labelValues(env=staging, app)',
      'labelValues(env=staging, app=staging-api, pod)',
    ]);
    expect(values['data query']).toEqual([
      expr('staging', 'staging-api', 'staging-api-0'),
    ]);
    expect(values.useInterpolator).toEqual([
      'env=staging app=prod-api pod=prod-api-0 (loading)',
      'env=staging app=staging-api pod=prod-api-0 (loading)',
      'env=staging app=staging-api pod=staging-api-0',
    ]);
    expect(commits).toEqual({
      useInterpolator: 3,
      useDataQuery: 4,
      VizPanel: 2,
    });
  });

  test('a change to app cascades to pod', async ({ page }) => {
    await gotoProd(page);
    await openCombobox(page, 'app', ['prod-api', 'prod-web']);

    await resetStats(page);
    await page.getByRole('option', { name: 'prod-web', exact: true }).click();

    await expect(interpolated(page)).toHaveText(
      'env=prod app=prod-web pod=prod-web-0',
    );
    await expect(dataQuery(page)).toHaveText(
      expr('prod', 'prod-web', 'prod-web-0'),
    );
    await waitForQuiet(page);

    const { commits, values } = await readStats(page);

    expect(values['variable query']).toEqual([
      'labelValues(env=prod, app=prod-web, pod)',
    ]);
    expect(values['data query']).toEqual([
      expr('prod', 'prod-web', 'prod-web-0'),
    ]);
    expect(values.useInterpolator).toEqual([
      'env=prod app=prod-web pod=prod-api-0 (loading)',
      'env=prod app=prod-web pod=prod-web-0',
    ]);
    expect(commits).toEqual({
      useInterpolator: 2,
      useDataQuery: 3,
      VizPanel: 1,
    });
  });

  // The baseline: no variable changes, so only the data query runs again
  test('a refresh only reruns the data query', async ({ page }) => {
    await gotoProd(page);

    await resetStats(page);
    await page.getByTestId('data-testid RefreshPicker run button').click();

    await expect(dataQuery(page)).toHaveText(
      expr('prod', 'prod-api', 'prod-api-0'),
    );
    await waitForQuiet(page);

    const { commits, values } = await readStats(page);

    expect(values['variable query']).toBeUndefined();
    expect(values['data query']).toEqual([
      expr('prod', 'prod-api', 'prod-api-0'),
    ]);
    expect(values.useInterpolator).toBeUndefined();
    expect(commits).toEqual({
      useInterpolator: 0,
      useDataQuery: 2,
      VizPanel: 2,
    });
  });
});
