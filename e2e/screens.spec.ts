import { expect, test } from '@playwright/test';
import { collectErrors, injectCss, LARGE_FONT_CSS, loadDemoData, SAFE_AREA_CSS, setLanguage, shot, shotScrolled, skipInstallHint, typeAmount } from './helpers';

const variants = [
  { folder: 'light', colorScheme: 'light' as const, largeFont: false, lang: 'de' as const },
  { folder: 'dark', colorScheme: 'dark' as const, largeFont: false, lang: 'de' as const },
  { folder: 'light-large-font', colorScheme: 'light' as const, largeFont: true, lang: 'de' as const },
  { folder: 'dark-en', colorScheme: 'dark' as const, largeFont: false, lang: 'en' as const },
];

for (const v of variants) {
  test.describe(`screens (${v.folder})`, () => {
    test.use({ colorScheme: v.colorScheme });

    test(`all main screens with demo data`, async ({ page }) => {
      test.setTimeout(180_000);
      const errors = collectErrors(page);
      await setLanguage(page, v.lang);
      await skipInstallHint(page);
      await injectCss(page, SAFE_AREA_CSS);
      if (v.largeFont) await injectCss(page, LARGE_FONT_CSS);

      await page.goto('./');
      await expect(page.getByTestId('onboarding')).toBeVisible();
      await shot(page, v.folder, '00-onboarding');
      await typeAmount(page, '3200');
      await page.getByTestId('onboarding-start').click();
      await expect(page.getByTestId('home-screen')).toBeVisible();
      await shot(page, v.folder, '01-home-empty');

      await loadDemoData(page);
      await expect(page.getByTestId('transaction-row').first()).toBeVisible();
      await shot(page, v.folder, '02-home');

      await page.getByTestId('tab-stats').click();
      await expect(page.getByTestId('donut')).toBeVisible();
      await expect(page.getByTestId('category-row').first()).toBeVisible();
      await shot(page, v.folder, '03-stats-month');
      await shotScrolled(page, v.folder, '03b-stats-month-bottom');
      // select the biggest segment
      const firstSegment = page.locator('[data-testid^="donut-segment-"]').first();
      await firstSegment.click({ force: true });
      await shot(page, v.folder, '04-stats-month-selected');
      await page.getByTestId('segment-year').click();
      await expect(page.getByTestId('bar-chart')).toBeVisible();
      await shot(page, v.folder, '05-stats-year');
      await shotScrolled(page, v.folder, '05b-stats-year-bottom');
      await page.getByTestId('segment-week').click();
      await shot(page, v.folder, '06-stats-week');
      await page.getByTestId('segment-INCOME').click();
      await shot(page, v.folder, '07-stats-week-income');
      await page.getByTestId('segment-custom').click();
      await shot(page, v.folder, '08-stats-period');

      await page.getByTestId('tab-transactions').click();
      await expect(page.getByTestId('transaction-list')).toBeVisible();
      await shot(page, v.folder, '09-transactions');
      await page.getByTestId('filter-button').click();
      await expect(page.getByTestId('filter-sheet')).toBeVisible();
      await shot(page, v.folder, '10-filter-sheet');
      await page.getByTestId('segment-EXPENSE').click();
      await page.getByTestId('apply-filters').click();
      await expect(page.getByTestId('filter-badge')).toHaveText('1');
      await page.getByTestId('search-input').fill('coop');
      await shot(page, v.folder, '11-transactions-filtered');
      await page.getByTestId('search-input').fill('');
      await page.getByTestId('transaction-row').first().click();
      await expect(page.getByTestId('details-screen')).toBeVisible();
      await shot(page, v.folder, '12-details');

      await page.getByTestId('edit-button').click();
      await expect(page.getByTestId('add-edit-screen')).toBeVisible();
      await shot(page, v.folder, '13-edit');
      await page.getByTestId('back-button').click();
      await expect(page.getByTestId('details-screen')).toBeVisible();
      await page.getByTestId('back-button').click();

      await page.getByTestId('fab-add').click();
      await expect(page.getByTestId('add-edit-screen')).toBeVisible();
      await typeAmount(page, '42.5');
      await shot(page, v.folder, '14-add');
      await page.getByTestId('category-tile').first().click();
      await shot(page, v.folder, '14b-add-category-selected');
      await page.getByTestId('repeat-MONTHLY').click();
      await expect(page.getByTestId('repeat-preview')).toBeVisible();
      await shotScrolled(page, v.folder, '15-add-repeat');
      await page.getByTestId('category-new').click();
      await expect(page.getByTestId('category-editor')).toBeVisible();
      await shot(page, v.folder, '16-new-category');
      await page.getByRole('button', { name: /cancel|abbrechen/i }).click();
      await page.getByTestId('back-button').click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await shot(page, v.folder, '17-discard-dialog');
      await page.getByRole('button', { name: /discard|verwerfen/i }).click();
      await expect(page.getByTestId('transactions-screen')).toBeVisible();

      await page.getByTestId('tab-home').click();
      await page.getByTestId('open-settings').click();
      await expect(page.getByTestId('settings-screen')).toBeVisible();
      await shot(page, v.folder, '18-settings');
      await page.getByTestId('row-categories').click();
      await expect(page.getByTestId('categories-screen')).toBeVisible();
      await shot(page, v.folder, '19-categories');
      await page.getByTestId('back-button').click();
      await page.getByTestId('row-tags').click();
      await expect(page.getByTestId('tag-row').first()).toBeVisible();
      await shot(page, v.folder, '20-tags');
      await page.getByTestId('back-button').click();
      await page.getByTestId('row-recurring').click();
      await expect(page.getByTestId('rule-row').first()).toBeVisible();
      await shot(page, v.folder, '21-recurring');
      await page.getByTestId('rule-row').first().getByRole('button').first().click();
      await expect(page.getByTestId('rule-edit-screen')).toBeVisible();
      await shot(page, v.folder, '22-rule-edit');
      await shotScrolled(page, v.folder, '22b-rule-edit-bottom');
      await page.getByTestId('back-button').click();
      await page.getByTestId('back-button').click();
      await page.getByTestId('row-theme').click();
      await expect(page.getByTestId('choice-sheet')).toBeVisible();
      await shot(page, v.folder, '23-theme-sheet');

      expect(errors, errors.join('\n')).toEqual([]);
    });
  });
}

test.describe('install hint', () => {
  test('is shown in Safari on iPhone and can be skipped', async ({ page }) => {
    await injectCss(page, SAFE_AREA_CSS);
    await page.goto('./');
    await expect(page.getByTestId('install-screen')).toBeVisible();
    await shot(page, 'light', '24-install-hint');
    await page.getByTestId('install-continue').click();
    await expect(page.getByTestId('onboarding')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('onboarding')).toBeVisible();
  });
});
