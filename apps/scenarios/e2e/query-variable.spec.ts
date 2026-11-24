import { expect, type Page, test } from '@playwright/test';

// Runs against /query-variable-demo, which nests two query variables on
// FakeLabeledDataSource:
//   label (single value):     query `labels()`, the label names
//   labelValue (multi value): query `labelValues(${label})`, the values of that label
// The page lists every variable query the data source receives. The labelValue
// combobox allows custom values.

function labelInput(page: Page) {
  return page.getByRole('combobox', { name: 'label', exact: true });
}

function labelValueInput(page: Page) {
  return page.getByRole('combobox', { name: 'labelValue', exact: true });
}

function interpolated(page: Page) {
  return page.getByTestId('interpolated');
}

/** Every variable query the data source received, in order. */
function variableQueries(page: Page) {
  return page.getByTestId('variable-queries').getByRole('listitem');
}

// A value from the URL is trusted, so neither variable has to query to check
// it. Without one, the label variable queries on mount to pick a value.
async function gotoWithValues(page: Page) {
  await page.goto('/query-variable-demo?var-label=env&var-labelValue=prod');

  await expect(labelInput(page)).toHaveValue('env');
  await expect(interpolated(page)).toHaveText('label=env labelValue=prod');
  await expect(variableQueries(page)).toHaveCount(0);
}

test.describe('query variable', () => {
  test('runs the label query only once its combobox opens', async ({
    page,
  }) => {
    await gotoWithValues(page);

    await labelInput(page).click();

    await expect(variableQueries(page)).toHaveText(['labels()']);
    await expect(page.getByRole('option')).toHaveText([
      'service',
      'env',
      'region',
    ]);
  });

  test('runs the labelValue query only once its combobox opens', async ({
    page,
  }) => {
    await gotoWithValues(page);

    await labelValueInput(page).click();

    await expect(variableQueries(page)).toHaveText(['labelValues(env)']);
    await expect(page.getByRole('option')).toHaveText([
      'prod',
      'staging',
      'dev',
    ]);
  });

  test('keeps a custom labelValue when both values come from the url', async ({
    page,
  }) => {
    await page.goto('/query-variable-demo?var-label=env&var-labelValue=custom');

    await expect(interpolated(page)).toHaveText('label=env labelValue=custom');

    await labelValueInput(page).click();

    await expect(variableQueries(page)).toHaveText(['labelValues(env)']);
    await expect(interpolated(page)).toHaveText('label=env labelValue=custom');
    await expect(page).toHaveURL(/var-labelValue=custom/);
  });

  test('keeps a typed labelValue through a reload', async ({ page }) => {
    await gotoWithValues(page);

    await labelValueInput(page).click();
    await labelValueInput(page).fill('canary');
    await page.getByRole('option', { name: /canary/ }).click();

    await expect(interpolated(page)).toHaveText(
      'label=env labelValue=prod,canary',
    );
    await expect(page).toHaveURL(/var-labelValue=prod&var-labelValue=canary/);

    await page.reload();

    await expect(interpolated(page)).toHaveText(
      'label=env labelValue=prod,canary',
    );
  });
});
