import { expect, test } from '@playwright/test';
import { onboard, setLanguage, skipInstallHint } from './helpers';

test('works offline after the first visit (service worker precache)', async ({ page, context }) => {
  await setLanguage(page, 'en');
  await skipInstallHint(page);
  await onboard(page, '5');
  // wait for the service worker to be installed and activated
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg?.active;
  }, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1000);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('balance-card')).toContainText('5.00');
  await page.getByTestId('fab-add').click();
  await expect(page.getByTestId('add-edit-screen')).toBeVisible();
  await context.setOffline(false);
});
