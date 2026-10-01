import { expect, test } from '@playwright/test';
import { collectErrors, onboard, setLanguage, skipInstallHint, typeAmount } from './helpers';

test.describe('core flows', () => {
  test.beforeEach(async ({ page }) => {
    await setLanguage(page, 'en');
    await skipInstallHint(page);
  });

  test('adds, edits, deletes and restores a transaction', async ({ page }) => {
    const errors = collectErrors(page);
    await onboard(page, '100');
    await expect(page.getByTestId('balance-card')).toContainText('100.00');

    await page.getByTestId('fab-add').click();
    await expect(page.getByTestId('save-button')).toBeDisabled();
    await typeAmount(page, '12.5');
    await expect(page.getByTestId('amount-display')).toContainText('12.5');
    await page.getByTestId('category-tile').first().click();
    await expect(page.getByTestId('keypad')).toHaveAttribute('aria-hidden', 'true');
    await page.getByTestId('tag-input').fill('coop');
    await page.getByTestId('tag-input').press('Enter');
    await page.getByTestId('tag-input').fill('weekly,');
    await expect(page.getByTestId('tag-chip')).toHaveCount(2);
    await page.getByTestId('comment-input').fill('Milk and bread');
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByText('Saved')).toBeVisible();
    await expect(page.getByTestId('balance-card')).toContainText('87.50');
    await expect(page.getByTestId('transaction-row')).toHaveCount(1);
    await expect(page.getByTestId('transaction-row')).toContainText('Today');
    await expect(page.getByTestId('transaction-row')).toContainText('Milk and bread');

    // details + edit
    await page.getByTestId('transaction-row').click();
    await expect(page.getByTestId('details-screen')).toContainText('12.50');
    await page.getByTestId('edit-button').click();
    await expect(page.getByTestId('keypad')).toHaveAttribute('aria-hidden', 'true');
    await page.getByTestId('amount-display').click();
    await page.getByTestId('key-backspace').click();
    await page.getByTestId('key-backspace').click();
    await page.getByTestId('key-0').click();
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('details-screen')).toContainText('12.00');
    await page.getByTestId('delete-button').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByText('Transaction deleted')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('transaction-row')).toHaveCount(1);
    await expect(page.getByTestId('balance-card')).toContainText('88.00');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('creates a recurring rule from the add screen and manages it', async ({ page }) => {
    await onboard(page, '0');
    await page.getByTestId('fab-add').click();
    await page.getByTestId('segment-INCOME').click();
    await typeAmount(page, '5000');
    await page.getByTestId('category-tile').first().click();
    await page.getByTestId('repeat-MONTHLY').click();
    await expect(page.getByTestId('repeat-preview')).toContainText(/Monthly on the/);
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('transaction-row')).toHaveCount(1);
    await page.getByTestId('open-settings').click();
    await page.getByTestId('row-recurring').click();
    await expect(page.getByTestId('rule-row')).toHaveCount(1);
    await expect(page.getByTestId('rule-row')).toContainText(/Monthly on the/);
    await page.getByTestId('rule-toggle').click();
    await expect(page.getByTestId('rule-row')).toContainText('Paused');
    await page.getByTestId('rule-row').getByRole('button').first().click();
    await expect(page.getByTestId('rule-edit-screen')).toBeVisible();
    await page.getByTestId('rule-delete').click();
    await page.getByTestId('delete-rule-keep').click();
    await expect(page.getByTestId('recurring-screen')).toBeVisible();
    await expect(page.getByTestId('rule-row')).toHaveCount(0);
  });

  test('keeps the statistics tab and period when switching tabs', async ({ page }) => {
    await onboard(page, '0');
    await page.getByTestId('tab-stats').click();
    await page.getByTestId('segment-year').click();
    await page.getByTestId('period-prev').click();
    const label = await page.getByTestId('period-label').textContent();
    await expect(page.getByTestId('period-today')).toBeVisible();
    await page.getByTestId('tab-home').click();
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('period-label')).toHaveText(label ?? '');
    await page.getByTestId('period-today').click();
    await expect(page.getByTestId('period-today')).toBeHidden();
  });

  test('export, backup reminder and delete all data', async ({ page }) => {
    await onboard(page, '0');
    await page.getByTestId('open-settings').click();
    await page.getByTestId('row-demo').click();
    await expect(page.getByTestId('row-demo')).toBeHidden({ timeout: 20_000 });
    await page.getByTestId('back-button').click();
    await expect(page.getByTestId('backup-reminder')).toBeVisible();
    await page.getByTestId('open-settings').click();
    await page.getByTestId('row-delete-all').click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.getByTestId('onboarding')).toBeVisible();
  });

  test('handles very long names, huge amounts and an empty database', async ({ page }) => {
    const errors = collectErrors(page);
    await onboard(page, '99999999.99');
    await expect(page.getByTestId('balance-card')).toContainText("99'999'999.99");
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('donut-empty')).toBeVisible();
    await page.getByTestId('tab-transactions').click();
    await expect(page.getByText('No transactions yet')).toBeVisible();
    await page.getByTestId('fab-add').click();
    await page.getByTestId('category-new').click();
    await page.getByTestId('category-name').fill('Supercalifragilisticexpialidocious Membership');
    await page.getByTestId('category-save').click();
    await expect(page.getByTestId('category-tile').filter({ hasText: 'Supercalifragilisticexpialidocious' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('amount-display').click();
    await typeAmount(page, '999999999');
    await expect(page.getByTestId('amount-display')).toContainText("99'999'999");
    await page.getByTestId('comment-input').fill('x'.repeat(300));
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('transactions-screen')).toBeVisible();
    await page.getByTestId('tab-home').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.screenshot({ path: 'screenshots/light/25-edge-cases-home.png' });
    await page.getByTestId('transaction-row').click();
    await page.screenshot({ path: 'screenshots/light/26-edge-cases-details.png' });
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test('asks before discarding unsaved changes on a browser back gesture', async ({ page }) => {
  await setLanguage(page, 'en');
  await skipInstallHint(page);
  await onboard(page, '0');
  await page.getByTestId('fab-add').click();
  await typeAmount(page, '5');
  await page.goBack();
  await expect(page.getByRole('alertdialog')).toContainText('Discard changes?');
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByTestId('add-edit-screen')).toBeVisible();
  await expect(page.getByTestId('amount-display')).toContainText('5');
  await page.goBack();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  // the draft is gone: opening the form again starts empty
  await page.getByTestId('fab-add').click();
  await expect(page.getByTestId('save-button')).toBeDisabled();
});
