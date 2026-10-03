import { expect, test } from '@playwright/test';
import { injectCss, onboard, SAFE_AREA_CSS, setLanguage, shot, skipInstallHint, typeAmount } from './helpers';

async function openAdd(page: import('@playwright/test').Page, amount = '5') {
  await page.getByTestId('fab-add').click();
  await expect(page.getByTestId('add-edit-screen')).toBeVisible();
  await typeAmount(page, amount);
  await page.getByTestId('category-tile').first().click();
}

test.describe('tags', () => {
  test.beforeEach(async ({ page }) => {
    await setLanguage(page, 'en');
    await skipInstallHint(page);
    await injectCss(page, SAFE_AREA_CSS);
  });

  test('typed tags are saved and shown in the list, the details and the edit form', async ({ page }) => {
    await onboard(page, '0');
    await openAdd(page);
    const input = page.getByTestId('tag-input');
    await input.fill('Mama');
    await input.press('Enter'); // Return / Done on the iPhone keyboard
    await input.pressSequentially('coop,'); // a comma adds the tag too
    await expect(page.getByTestId('tag-chip')).toHaveText(['Mama', 'coop']);
    await expect(input).toHaveValue('');
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('transaction-row').locator('.tag')).toHaveText(['coop', 'Mama']);

    await page.getByTestId('transaction-row').click();
    await expect(page.getByTestId('details-screen').locator('.tag')).toHaveText(['coop', 'Mama']);
    await page.getByTestId('edit-button').click();
    await expect(page.getByTestId('tag-chip')).toHaveText(['coop', 'Mama']);

    // the transactions list and the tag management show them as well
    await page.getByTestId('back-button').click();
    await page.getByTestId('back-button').click();
    await page.getByTestId('tab-transactions').click();
    await expect(page.getByTestId('transaction-row').locator('.tag')).toHaveText(['coop', 'Mama']);
    await page.getByTestId('tab-home').click();
    await page.getByTestId('open-settings').click();
    await page.getByTestId('row-tags').click();
    await expect(page.getByTestId('tag-row')).toHaveCount(2);
  });

  test('text still in the tag field is taken over when saving, even without a blur (iOS)', async ({ page }) => {
    await onboard(page, '0');
    await openAdd(page);
    await page.getByTestId('tag-input').fill('Papa');
    // On iOS, tapping a button does not blur the focused input, so simulate a click without focus change.
    await page.getByTestId('save-button').dispatchEvent('click');
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('transaction-row').locator('.tag')).toHaveText(['Papa']);
  });

  test('suggests used tags that start with the typed text and merges different spellings', async ({ page }) => {
    await onboard(page, '0');
    await openAdd(page);
    await page.getByTestId('tag-input').fill('Mama');
    await page.getByTestId('tag-input').press('Enter');
    await page.getByTestId('tag-input').fill('Oma');
    await page.getByTestId('tag-input').press('Enter');
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();

    await openAdd(page, '7');
    const input = page.getByTestId('tag-input');
    await input.pressSequentially('Ma');
    const suggestions = page.getByTestId('tag-suggestions');
    await expect(suggestions).toBeVisible();
    await expect(suggestions.locator('.chip')).toHaveText(['Mama']); // "Oma" contains "ma" but does not start with it
    await expect(page.locator('.toast')).toBeHidden({ timeout: 10_000 });
    await shot(page, 'light', '27-add-tag-suggestions');
    await suggestions.getByRole('button', { name: 'Mama' }).click(); // tapping a suggestion adds it
    await expect(page.getByTestId('tag-chip')).toHaveText(['Mama']);
    await expect(input).toHaveValue('');
    // lower-case spelling is the same tag: not suggested again and not added twice
    await input.pressSequentially('mama');
    await expect(suggestions).toBeHidden();
    await input.press('Enter');
    await expect(page.getByTestId('tag-chip')).toHaveText(['Mama']);
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();

    await page.getByTestId('open-settings').click();
    await page.getByTestId('row-tags').click();
    await expect(page.getByTestId('tag-row')).toHaveText([/Mama.*2 transactions/, /Oma.*1 transaction/]);
  });

  test('shows the 5 most used tags while the empty field is active', async ({ page }) => {
    await onboard(page, '0');
    await page.getByTestId('open-settings').click();
    await page.getByTestId('row-demo').click();
    await expect(page.getByTestId('row-demo')).toBeHidden({ timeout: 20_000 });
    // the tag management lists all tags most used first; the first five must be the suggestions
    await page.getByTestId('row-tags').click();
    const topFive = (await page.getByTestId('tag-row').locator('.settings-row__title').allTextContents()).slice(0, 5);
    expect(topFive).toHaveLength(5);
    await page.getByTestId('back-button').click();
    await page.getByTestId('back-button').click();
    await openAdd(page);
    await page.getByTestId('tag-input').focus();
    const suggestions = page.getByTestId('tag-suggestions');
    await expect(suggestions.locator('.chip')).toHaveText(topFive);
    await expect(page.getByTestId('save-button')).toBeEnabled();
    await expect(page.locator('.toast')).toBeHidden({ timeout: 10_000 });
    await shot(page, 'light', '28-add-tag-top5');
  });
});
