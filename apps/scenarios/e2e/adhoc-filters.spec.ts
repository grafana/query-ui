import { expect, type Page, test } from '@playwright/test';

// Runs against /adhoc-filters-demo, backed by FakeLabeledDataSource:
//   service: checkout, cart, auth
//   env:     prod, staging, dev
//   region:  us-east, us-west, eu

function addInput(page: Page) {
  return page.getByPlaceholder('+ label = value');
}

function options(page: Page) {
  return page.getByRole('option');
}

function pill(page: Page, key: string) {
  return page.getByRole('button', { name: `Edit filter with key ${key}` });
}

test.describe('adhoc filters combobox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/adhoc-filters-demo');
  });

  test('adds a filter with the keyboard, opening each step in turn', async ({
    page,
  }) => {
    await addInput(page).click();
    await expect(options(page)).toHaveText(['service', 'env', 'region']);

    await page.keyboard.press('ArrowDown');
    await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');

    // Operators open on their own once a key is picked.
    await expect(options(page).first()).toContainText('Equals');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Then the values.
    await expect(options(page)).toHaveText(['prod', 'staging', 'dev']);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(pill(page, 'env')).toHaveText('env != staging');
    // The input stays open on the keys, ready for the next filter.
    await expect(options(page)).toHaveText(['service', 'env', 'region']);
    await expect(addInput(page)).toBeFocused();
  });

  test('adds a filter with the mouse', async ({ page }) => {
    await addInput(page).click();
    await options(page).filter({ hasText: 'region' }).click();
    await options(page).filter({ hasText: 'Equals' }).click();
    await options(page).filter({ hasText: 'eu' }).click();

    await expect(pill(page, 'region')).toHaveText('region = eu');
  });

  test('filters options as you type and offers custom values', async ({
    page,
  }) => {
    await addInput(page).click();
    await page.keyboard.type('reg');

    await expect(options(page)).toHaveText(['region', 'Use custom value: reg']);
  });

  test('collects several values for a "one of" filter', async ({ page }) => {
    await addInput(page).click();
    await options(page).filter({ hasText: 'service' }).click();
    await options(page)
      .filter({ hasText: /^=\|One of/ })
      .click();

    await options(page).filter({ hasText: 'checkout' }).click();
    await options(page).filter({ hasText: 'auth' }).click();

    await expect(
      page.getByRole('button', { name: 'Remove filter value - checkout' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove filter value - auth' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(pill(page, 'service')).toHaveText('service =| checkout, auth');
    await expect(page.getByRole('listbox')).toBeHidden();
  });

  test('adds a filter typed as an expression', async ({ page }) => {
    await addInput(page).click();
    await page.keyboard.type('env =| prod, dev');

    await expect(page.getByRole('listbox')).toHaveText(
      'Press Enter to apply: env =| prod, dev',
    );
    await page.keyboard.press('Enter');

    await expect(pill(page, 'env')).toHaveText('env =| prod, dev');
  });

  test('moves on to the values after a typed key and operator', async ({
    page,
  }) => {
    await addInput(page).click();
    await page.keyboard.type('service !=');
    await page.keyboard.press('Enter');

    await expect(options(page)).toHaveText(['checkout', 'cart', 'auth']);
    await page.keyboard.press('Enter');

    await expect(pill(page, 'service')).toHaveText('service != checkout');
  });

  test('edits a filter from its pill', async ({ page }) => {
    await addInput(page).click();
    await page.keyboard.type('env = prod');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');

    await pill(page, 'env').click();

    const valueInput = page.getByRole('combobox', { name: 'Filter value' });
    await expect(valueInput).toHaveValue('prod');
    await expect(valueInput).toBeFocused();

    await page.keyboard.type('dev');
    await page.keyboard.press('Enter');

    await expect(pill(page, 'env')).toHaveText('env = dev');
    // The last filter hands focus back to the add input.
    await expect(addInput(page)).toBeFocused();
  });

  test('changes the operator of an existing filter', async ({ page }) => {
    await addInput(page).click();
    await page.keyboard.type('env = prod');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');

    await pill(page, 'env').click();
    await page.getByRole('button', { name: 'Edit filter operator' }).click();
    await options(page).filter({ hasText: 'Not equal' }).first().click();
    await page.keyboard.press('Enter');

    await expect(pill(page, 'env')).toHaveText('env != prod');
  });

  test('steps back into the last filter with Backspace', async ({ page }) => {
    await addInput(page).click();
    await page.keyboard.type('env =| prod, dev');
    await page.keyboard.press('Enter');

    // Empty add input: Backspace opens the previous filter.
    await page.keyboard.press('Backspace');
    const valueInput = page.getByRole('combobox', { name: 'Filter value' });
    await expect(valueInput).toBeFocused();

    // Removes the last picked value, then Escape saves the edit.
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Escape');

    await expect(pill(page, 'env')).toHaveText('env =| prod');
    await expect(pill(page, 'env')).toBeFocused();
  });

  test('removes a filter and clears all filters', async ({ page }) => {
    await addInput(page).click();
    await page.keyboard.type('env = prod');
    await page.keyboard.press('Enter');
    await page.keyboard.type('service = cart');
    await page.keyboard.press('Enter');
    await page.keyboard.type('region = eu');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');

    await page
      .getByRole('button', { name: 'Remove filter with key service' })
      .click();
    await expect(pill(page, 'service')).toBeHidden();
    await expect(pill(page, 'env')).toBeVisible();

    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(pill(page, 'env')).toBeHidden();
    await expect(pill(page, 'region')).toBeHidden();
  });

  test('saves an edit on an outside click', async ({ page }) => {
    await addInput(page).click();
    await page.keyboard.type('region =| eu');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');

    await pill(page, 'region').click();
    await options(page).filter({ hasText: 'us-west' }).click();
    await page.getByRole('heading', { name: 'Adhoc filters demo' }).click();

    await expect(pill(page, 'region')).toHaveText('region =| eu, us-west');
    await expect(page.getByRole('listbox')).toBeHidden();
  });
});
