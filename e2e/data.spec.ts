import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { onboard, setLanguage, skipInstallHint, typeAmount } from './helpers';

test.describe('pictures, backup and export', () => {
  test.beforeEach(async ({ page }) => {
    await setLanguage(page, 'en');
    await skipInstallHint(page);
  });

  test('adds pictures to a transaction and shows them in the viewer', async ({ page }) => {
    await onboard(page, '0');
    await page.getByTestId('fab-add').click();
    await typeAmount(page, '9.9');
    await page.getByTestId('category-tile').first().click();
    const icon = readFileSync('public/icons/icon-512.png');
    await page.getByTestId('picture-input').setInputFiles([
      { name: 'a.png', mimeType: 'image/png', buffer: icon },
      { name: 'b.png', mimeType: 'image/png', buffer: icon },
    ]);
    await expect(page.getByTestId('pictures').locator('.thumb img')).toHaveCount(2);
    await page.getByTestId('thumb-remove').first().click();
    await expect(page.getByTestId('pictures').locator('.thumb img')).toHaveCount(1);
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('transaction-row').locator('.row__meta')).toBeVisible();
    await page.getByTestId('transaction-row').click();
    await expect(page.getByTestId('pictures').locator('.thumb img')).toHaveCount(1);
    await page.getByTestId('pictures').locator('.thumb button').first().click();
    await expect(page.getByTestId('picture-viewer')).toBeVisible();
    await expect(page.getByTestId('picture-viewer')).toContainText('Picture 1 of 1');
    await page.getByTestId('picture-viewer').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('picture-viewer')).toBeHidden();
    // the stored picture is a JPEG no larger than 2000 px
    const info = await page.evaluate(async () => {
      const req = indexedDB.open('finance-app');
      const db = await new Promise<IDBDatabase>((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const tx = db.transaction('attachments', 'readonly');
      const all = await new Promise<Array<{ data: ArrayBuffer; mimeType: string; width: number; height: number }>>((res) => {
        const r = tx.objectStore('attachments').getAll();
        r.onsuccess = () => res(r.result);
      });
      // JPEG magic bytes FF D8
      return all.map((a) => ({ type: a.mimeType, width: a.width, height: a.height, jpeg: new Uint8Array(a.data)[0] === 0xff && new Uint8Array(a.data)[1] === 0xd8 }));
    });
    expect(info).toEqual([{ type: 'image/jpeg', width: 512, height: 512, jpeg: true }]);
  });

  test('backs up to a zip file, exports CSV, and restores the backup', async ({ page }) => {
    await onboard(page, '250');
    await page.getByTestId('fab-add').click();
    await typeAmount(page, '12.5');
    await page.getByTestId('category-tile').first().click();
    await page.getByTestId('tag-input').fill('coop');
    await page.getByTestId('tag-input').press('Enter');
    await page.getByTestId('comment-input').fill('Milk; "eggs"');
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();

    await page.getByTestId('open-settings').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('row-backup').click()]);
    expect(download.suggestedFilename()).toMatch(/^financeapp-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    const zipPath = await download.path();
    await expect(page.getByTestId('row-backup')).toContainText('Last backup');

    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('row-export').click()]);
    const csvText = readFileSync((await csv.path())!, 'utf8');
    expect(csvText.charCodeAt(0)).toBe(0xfeff);
    expect(csvText).toContain('date;type;category;amount;currency;tags;comment');
    expect(csvText).toContain(';EXPENSE;Groceries;-12.50;CHF;coop;"Milk; ""eggs"""');

    // wipe everything, then restore from the zip
    await page.getByTestId('row-delete-all').click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.getByTestId('onboarding')).toBeVisible();
    await page.getByTestId('onboarding').locator('input[type=file]').setInputFiles(zipPath!);
    await expect(page.getByRole('alertdialog')).toContainText('1 transactions, 18 categories, 0 pictures');
    await page.getByRole('button', { name: 'Replace and restore' }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('balance-card')).toContainText('237.50');
    await expect(page.getByTestId('transaction-row')).toContainText('Milk; "eggs"');
  });

  test('rejects an invalid backup file without touching the data', async ({ page }) => {
    await onboard(page, '1');
    await page.getByTestId('open-settings').click();
    await page.getByTestId('restore-input').setInputFiles({ name: 'x.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip') });
    await expect(page.getByRole('alertdialog')).toContainText('not a Finance-App backup');
    await page.getByRole('button', { name: 'OK' }).click();
    await page.getByTestId('back-button').click();
    await expect(page.getByTestId('balance-card')).toContainText('1.00');
  });
});
