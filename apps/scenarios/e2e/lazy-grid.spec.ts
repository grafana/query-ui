import { expect, type Page, test } from '@playwright/test';

const PANEL_COUNT = 30;
const LAST_PANEL = PANEL_COUNT - 1;

// Fixed so the number of rows that fit on screen is predictable.
test.use({ viewport: { width: 1280, height: 720 } });

async function mountedCount(page: Page) {
  const text = await page.getByTestId('mounted-count').innerText();
  return Number(/Mounted panels: (\d+)/.exec(text)?.[1]);
}

test.describe('lazy grid layout', () => {
  test('mounts only the panels near the viewport on load', async ({ page }) => {
    await page.goto('/lazy-grid-demo');

    await expect(page.getByTestId('lazy-panel-0')).toBeVisible();
    await expect(page.getByTestId('lazy-panel-0')).toContainText('Panel 0');

    const count = await mountedCount(page);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(PANEL_COUNT);
    await expect(page.getByTestId(`lazy-panel-${LAST_PANEL}`)).toHaveCount(0);
  });

  test('mounts a panel once it is scrolled into view', async ({ page }) => {
    await page.goto('/lazy-grid-demo');
    await expect(page.getByTestId('lazy-panel-0')).toBeVisible();
    await expect(page.getByTestId(`lazy-panel-${LAST_PANEL}`)).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const lastPanel = page.getByTestId(`lazy-panel-${LAST_PANEL}`);
    await expect(lastPanel).toBeVisible();
    await expect(lastPanel).toContainText(`Panel ${LAST_PANEL}`);
  });

  test('keeps a panel mounted after it scrolls out of view', async ({
    page,
  }) => {
    await page.goto('/lazy-grid-demo');
    await expect(page.getByTestId('lazy-panel-0')).toBeVisible();
    await expect(page.getByTestId(`lazy-panel-${LAST_PANEL}`)).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId(`lazy-panel-${LAST_PANEL}`)).toBeVisible();

    await expect(page.getByTestId('lazy-panel-0')).not.toBeInViewport();
    await expect(page.getByTestId('lazy-panel-0')).toHaveCount(1);
  });

  test('mounts every panel once the whole grid has been scrolled through', async ({
    page,
  }) => {
    await page.goto('/lazy-grid-demo');
    await expect(page.getByTestId('lazy-panel-0')).toBeVisible();
    await expect(page.getByTestId(`lazy-panel-${LAST_PANEL}`)).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId(`lazy-panel-${LAST_PANEL}`)).toBeVisible();

    // Scrolling straight to the bottom can skip middle rows; scroll back up
    // in steps so each one passes through the viewport.
    for (let y = await page.evaluate(() => window.scrollY); y > 0; y -= 300) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
    }

    await expect(page.getByTestId('mounted-count')).toHaveText(
      `Mounted panels: ${PANEL_COUNT} of ${PANEL_COUNT}`,
    );
  });
});
