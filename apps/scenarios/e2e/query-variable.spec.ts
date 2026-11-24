import { expect, type Page, test } from '@playwright/test';

// Runs against /query-variable-demo, which nests two query variables on
// FakeLabeledDataSource:
//   label (single value):     query `labels()`, the label names
//   labelValue (multi value): query `labelValues(${label})`, the values of that label
// The page lists every variable query the data source receives.

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
});
