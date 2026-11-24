import { expect, type Page, test } from '@playwright/test';

// Runs against /variables-demo, which defines two variables with static options:
//   service (single value): API, Web, DB, starting at API
//   pod (multi value):      Pod 1, Pod 2, Pod 3, starting at [Pod 1]

function serviceInput(page: Page) {
  return page.getByRole('combobox', { name: 'service' });
}

function podInput(page: Page) {
  return page.getByRole('combobox', { name: 'pod' });
}

function option(page: Page, label: string) {
  return page.getByRole('option', { name: label, exact: true });
}

/** The remove button on a selected pod's pill, so one per selected value. */
function podPill(page: Page, label: string) {
  return page.getByRole('button', { name: `Remove ${label}` });
}

function interpolated(page: Page) {
  return page.getByTestId('interpolated');
}

/** The variables' own labels, which the comboboxes don't show. */
function labels(page: Page) {
  return page.getByTestId('labels');
}

function urlValues(page: Page, name: string) {
  return new URL(page.url()).searchParams.getAll(`var-${name}`);
}

test.describe('variable comboboxes', () => {
  test('start from the values the variables were given', async ({ page }) => {
    await page.goto('/variables-demo');

    await expect(serviceInput(page)).toHaveValue('API');
    await expect(podPill(page, 'Pod 1')).toBeVisible();
    await expect(interpolated(page)).toHaveText('service=api pod=pod1');
    expect(urlValues(page, 'service')).toEqual([]);
    expect(urlValues(page, 'pod')).toEqual([]);
  });

  test('pick a single value', async ({ page }) => {
    await page.goto('/variables-demo');

    await serviceInput(page).click();
    await expect(page.getByRole('option')).toHaveText(['API', 'Web', 'DB']);
    await option(page, 'Web').click();

    await expect(serviceInput(page)).toHaveValue('Web');
    await expect(interpolated(page)).toHaveText('service=web pod=pod1');
    await expect(labels(page)).toHaveText('Web / Pod 1');
    await expect.poll(() => urlValues(page, 'service')).toEqual(['web']);
  });

  test('pick and remove several values', async ({ page }) => {
    await page.goto('/variables-demo');

    await podInput(page).click();
    await expect(page.getByRole('option')).toHaveText([
      'Pod 1',
      'Pod 2',
      'Pod 3',
    ]);
    await option(page, 'Pod 2').click();
    await option(page, 'Pod 3').click();
    await page.keyboard.press('Escape');

    await expect(interpolated(page)).toHaveText(
      'service=api pod=pod1,pod2,pod3',
    );
    await expect
      .poll(() => urlValues(page, 'pod'))
      .toEqual(['pod1', 'pod2', 'pod3']);

    await podPill(page, 'Pod 1').click();

    await expect(podPill(page, 'Pod 1')).toBeHidden();
    await expect(interpolated(page)).toHaveText('service=api pod=pod2,pod3');
    await expect.poll(() => urlValues(page, 'pod')).toEqual(['pod2', 'pod3']);
  });
});

test.describe('variable url state', () => {
  test('restores both variables from the URL, labeled from the options', async ({
    page,
  }) => {
    await page.goto('/variables-demo?var-service=db&var-pod=pod2&var-pod=pod3');

    await expect(serviceInput(page)).toHaveValue('DB');
    await expect(podPill(page, 'Pod 2')).toBeVisible();
    await expect(podPill(page, 'Pod 3')).toBeVisible();
    await expect(podPill(page, 'Pod 1')).toBeHidden();
    await expect(interpolated(page)).toHaveText('service=db pod=pod2,pod3');
    await expect(labels(page)).toHaveText('DB / Pod 2 + Pod 3');
  });

  test('keeps the picked values through a reload', async ({ page }) => {
    await page.goto('/variables-demo');

    await serviceInput(page).click();
    await option(page, 'DB').click();
    await podInput(page).click();
    await option(page, 'Pod 3').click();
    await page.keyboard.press('Escape');
    await expect.poll(() => urlValues(page, 'pod')).toEqual(['pod1', 'pod3']);

    await page.reload();

    await expect(serviceInput(page)).toHaveValue('DB');
    await expect(interpolated(page)).toHaveText('service=db pod=pod1,pod3');
  });

  test('follows the browser history', async ({ page }) => {
    await page.goto('/variables-demo');

    await serviceInput(page).click();
    await option(page, 'Web').click();
    await expect.poll(() => urlValues(page, 'service')).toEqual(['web']);

    await podInput(page).click();
    await option(page, 'Pod 2').click();
    await page.keyboard.press('Escape');
    await expect.poll(() => urlValues(page, 'pod')).toEqual(['pod1', 'pod2']);

    await page.goBack();

    await expect(podPill(page, 'Pod 2')).toBeHidden();
    await expect(interpolated(page)).toHaveText('service=web pod=pod1');

    await page.goBack();

    await expect(serviceInput(page)).toHaveValue('API');
    await expect(interpolated(page)).toHaveText('service=api pod=pod1');
  });
});
