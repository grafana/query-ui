import { expect, type Page, test } from '@playwright/test';

// The counter on the page reports how the fake data source saw each query end,
// so these tests can tell a canceled query from one whose result was ignored.
function stats(page: Page) {
  return page.getByTestId('query-stats');
}

function runButton(page: Page) {
  return page.getByTestId('data-testid RefreshPicker run button');
}

function panel(page: Page, title: string) {
  return page.getByTestId(`data-testid Panel header ${title}`);
}

// PanelChrome sets `panel-cancel-query` on the button, but TitleItem doesn't
// pass it through to the DOM, so find the button by its icon.
function cancelButton(page: Page, title: string) {
  return panel(page, title)
    .getByRole('button')
    .filter({ has: page.getByTestId('icon-sync-slash') });
}

test.describe('slow query', () => {
  test('shows the data once the queries finish', async ({ page }) => {
    await page.goto('/slow-query-demo?delayMs=1000');

    await expect(stats(page)).toHaveText(
      'Running: 2, completed: 0, canceled: 0',
    );
    await expect(runButton(page)).toHaveAccessibleName('Cancel');

    await expect(stats(page)).toHaveText(
      'Running: 0, completed: 2, canceled: 0',
    );
    await expect(runButton(page)).toHaveAccessibleName('Refresh');
    await expect(panel(page, 'Slow A')).not.toContainText('Loading');
    await expect(panel(page, 'Slow A')).not.toContainText('No data');
  });

  test('the refresh button cancels every running query', async ({ page }) => {
    await page.goto('/slow-query-demo');
    await expect(stats(page)).toHaveText(
      'Running: 2, completed: 0, canceled: 0',
    );

    await runButton(page).click();

    await expect(stats(page)).toHaveText(
      'Running: 0, completed: 0, canceled: 2',
    );
    await expect(runButton(page)).toHaveAccessibleName('Refresh');
    await expect(panel(page, 'Slow A')).toContainText('No data');
    await expect(panel(page, 'Slow B')).toContainText('No data');
  });

  test('a panel cancel button cancels only that panel', async ({ page }) => {
    // The fake clock skips the waits below instead of sitting through them.
    // Between skips, time runs normally.
    await page.clock.install();
    await page.goto('/slow-query-demo?delayMs=10000');

    // A panel has no cancel button until it has data, so let the first load
    // finish and cancel a refresh instead.
    await expect(stats(page)).toHaveText(
      'Running: 2, completed: 0, canceled: 0',
    );
    await page.clock.fastForward(10_000);
    await expect(stats(page)).toHaveText(
      'Running: 0, completed: 2, canceled: 0',
    );

    await runButton(page).click();
    await expect(stats(page)).toHaveText(
      'Running: 2, completed: 2, canceled: 0',
    );

    // PanelChrome shows the cancel button two seconds into a query. That
    // leaves eight seconds before the other panel's query would finish.
    await page.clock.fastForward(2_000);
    await cancelButton(page, 'Slow A').click();

    await expect(stats(page)).toHaveText(
      'Running: 1, completed: 2, canceled: 1',
    );
    await expect(cancelButton(page, 'Slow A')).toHaveCount(0);
    await expect(cancelButton(page, 'Slow B')).toBeVisible();
    await expect(runButton(page)).toHaveAccessibleName('Cancel');
  });
});
