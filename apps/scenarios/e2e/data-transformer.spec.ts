import { expect, type Page, test } from '@playwright/test';

// Runs against /data-transformer-demo: one panel queries the fake random-walk
// data source (31 rows), runs the result through useDataTransformer and shows
// it in a VizPanel. The "Limit to 10 rows" switch adds a limit transformation.
//
// Probes count the commits of the component calling both hooks
// (TransformedPanel), of the VizPanel it feeds (through a React Profiler), and
// of FakeTimeSeriesPanel, the panel plugin VizPanel renders. TransformedPanel
// also records the state and row count it shows, each time they change. The
// page exposes all of it as `window.__renderStats`.

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

function rowCount(page: Page) {
  return page.getByTestId('row-count');
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
  // in the report but left out here.
  const commits = {
    TransformedPanel: renders.TransformedPanel ?? 0,
    VizPanel: renders.VizPanel ?? 0,
    FakeTimeSeriesPanel: renders.FakeTimeSeriesPanel ?? 0,
  };

  return { commits, values: values.TransformedPanel ?? [] };
}

async function gotoDemo(page: Page) {
  await page.goto('/data-transformer-demo');
  await expect(rowCount(page)).toHaveText('31 rows');
  await waitForQuiet(page);
}

async function turnOnTransformation(page: Page) {
  // The input is hidden behind the styled switch, so click its label.
  await page.getByText('Limit to 10 rows', { exact: true }).click();
  await expect(
    page.getByRole('switch', { name: 'Limit to 10 rows' }),
  ).toBeChecked();
  await expect(rowCount(page)).toHaveText('10 rows');
  await waitForQuiet(page);
}

async function refresh(page: Page) {
  await resetStats(page);
  await page.getByTestId('data-testid RefreshPicker run button').click();
  await waitForQuiet(page);
}

test.describe('data transformer', () => {
  // The baseline: without transformations the hook hands the query data
  // through, so a refresh commits once when it starts and once when it's done.
  test('a refresh without the transformation', async ({ page }) => {
    await gotoDemo(page);

    await refresh(page);

    const { commits, values } = await readStats(page);

    expect(values).toEqual(['Loading 31 rows', 'Done 31 rows']);
    expect(commits).toEqual({
      TransformedPanel: 2,
      VizPanel: 2,
      FakeTimeSeriesPanel: 2,
    });
  });

  // Transformations run asynchronously, so the transformed frames arrive one
  // commit after the query data. Meanwhile the previous frames stay up as
  // loading. A refresh starting only changes the loading state, so the frames
  // aren't transformed again then: one extra commit in all.
  test('a refresh with the transformation', async ({ page }) => {
    await gotoDemo(page);
    await turnOnTransformation(page);

    await refresh(page);

    const { commits, values } = await readStats(page);

    expect(values).toEqual(['Loading 10 rows', 'Done 10 rows']);
    expect(commits).toEqual({
      TransformedPanel: 3,
      VizPanel: 3,
      FakeTimeSeriesPanel: 3,
    });
  });

  // Until the first pass is done the hook has no transformed frames, and it
  // never shows untransformed ones, so the panel shows no data for a commit.
  test('turning the transformation on', async ({ page }) => {
    await gotoDemo(page);
    await resetStats(page);

    await turnOnTransformation(page);

    const { commits, values } = await readStats(page);

    expect(values).toEqual(['no data 0 rows', 'Done 10 rows']);
    expect(commits).toEqual({
      TransformedPanel: 2,
      VizPanel: 2,
      FakeTimeSeriesPanel: 2,
    });
  });
});
