import { expect, type Page, test } from '@playwright/test';

const seriesNames = ['A-series-1', 'A-series-2', 'A-series-3'];

// A series the fake panel draws in its graph area
function graphSeries(page: Page, name: string) {
  return page.getByTestId(`fake-series ${name}`);
}

function legendItem(page: Page, name: string) {
  return page
    .getByTestId(`data-testid VizLegend series ${name}`)
    .getByRole('button');
}

async function expectVisibleSeries(page: Page, visible: string[]) {
  for (const name of seriesNames) {
    await expect(graphSeries(page, name)).toHaveCount(
      visible.includes(name) ? 1 : 0,
    );
  }
}

test.describe('legend series visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/many-series-demo');
    await expectVisibleSeries(page, seriesNames);
  });

  test('clicking a series shows only that series', async ({ page }) => {
    await legendItem(page, 'A-series-1').click();

    await expectVisibleSeries(page, ['A-series-1']);
    // Hidden series stay in the legend so they can be shown again
    for (const name of seriesNames) {
      await expect(legendItem(page, name)).toBeVisible();
    }
  });

  test('clicking the selected series again shows all series', async ({
    page,
  }) => {
    await legendItem(page, 'A-series-1').click();
    await expectVisibleSeries(page, ['A-series-1']);

    await legendItem(page, 'A-series-1').click();

    await expectVisibleSeries(page, seriesNames);
  });

  test('a modifier click hides only that series', async ({ page }) => {
    await legendItem(page, 'A-series-2').click({
      modifiers: ['ControlOrMeta'],
    });

    await expectVisibleSeries(page, ['A-series-1', 'A-series-3']);

    await legendItem(page, 'A-series-2').click({
      modifiers: ['ControlOrMeta'],
    });

    await expectVisibleSeries(page, seriesNames);
  });
});
