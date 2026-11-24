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

/** The queries the label variable sent: `__keys`, with any search filter. */
function labelQueries(page: Page) {
  return page
    .getByTestId('variable-queries')
    .getByRole('listitem')
    .filter({ hasText: /^__keys/ });
}

test.describe('query variable', () => {
  test('runs the label query only once its combobox opens', async ({
    page,
  }) => {
    // A value from the URL is trusted, so the label variable has no need to
    // query to check it. Without one, it queries on mount to pick a value.
    await page.goto('/query-variable-demo?var-label=env&var-labelValue=prod');

    await expect(labelInput(page)).toHaveValue('env');
    await expect(interpolated(page)).toHaveText('label=env labelValue=prod');
    await expect(labelQueries(page)).toHaveCount(0);

    await labelInput(page).click();

    await expect(labelQueries(page)).toHaveText(['__keys']);
    await expect(page.getByRole('option')).toHaveText([
      'service',
      'env',
      'region',
    ]);
  });
});
