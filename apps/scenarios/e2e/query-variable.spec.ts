import { expect, type Page, test } from '@playwright/test';

// Runs against /query-variable-demo, which nests two query variables on
// FakeLabeledDataSource:
//   label (single value):     query `__keys`, the label names
//   labelValue (multi value): query `${label}`, the values of that label
// The page lists every variable query the data source receives.

function labelInput(page: Page) {
  return page.getByRole('combobox', { name: 'label', exact: true });
}

function interpolated(page: Page) {
  return page.getByTestId('interpolated');
}

/** Every variable query the data source received, in order. */
function variableQueries(page: Page) {
  return page.getByTestId('variable-queries').getByRole('listitem');
}

test.describe('query variable', () => {
  test('runs the label query only once its combobox opens', async ({
    page,
  }) => {
    // A value from the URL is trusted, so neither variable has to query to
    // check it. Without one, the label variable queries on mount to pick a value.
    await page.goto('/query-variable-demo?var-label=env&var-labelValue=prod');

    await expect(labelInput(page)).toHaveValue('env');
    await expect(interpolated(page)).toHaveText('label=env labelValue=prod');
    await expect(variableQueries(page)).toHaveCount(0);

    await labelInput(page).click();

    await expect(variableQueries(page)).toHaveText(['__keys']);
    await expect(page.getByRole('option')).toHaveText([
      'service',
      'env',
      'region',
    ]);
  });
});
