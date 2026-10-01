import { expect, type Page } from '@playwright/test';

export const LARGE_FONT_CSS = 'html { font-size: 22px !important; }';
/** Simulates the iPhone notch and home indicator (Playwright has no safe-area insets). */
export const SAFE_AREA_CSS = ':root { --safe-top: 54px; --safe-bottom: 34px; }';

export async function injectCss(page: Page, css: string): Promise<void> {
  await page.addInitScript((text) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = text;
      document.head.appendChild(s);
    });
  }, css);
}

/** Screenshot of the current screen scrolled to the bottom of its body. */
export async function shotScrolled(page: Page, folder: string, name: string): Promise<void> {
  await page.evaluate(() => {
    const body = document.querySelector('.screen__body');
    if (body) body.scrollTop = body.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `screenshots/${folder}/${name}.png` });
  await page.evaluate(() => {
    const body = document.querySelector('.screen__body');
    if (body) body.scrollTop = 0;
  });
}

/** Skips the install hint (as if the app were opened from the Home Screen). */
export async function skipInstallHint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('fa:install-dismissed', '1');
  });
}

export async function setLanguage(page: Page, lang: 'de' | 'en'): Promise<void> {
  await page.addInitScript((l) => {
    Object.defineProperty(navigator, 'language', { get: () => (l === 'de' ? 'de-CH' : 'en-US') });
    Object.defineProperty(navigator, 'languages', { get: () => (l === 'de' ? ['de-CH', 'de'] : ['en-US', 'en']) });
  }, lang);
}

/** Completes the first-launch screen with a starting balance. */
export async function onboard(page: Page, balance = '3200'): Promise<void> {
  await page.goto('./');
  await expect(page.getByTestId('onboarding')).toBeVisible();
  await typeAmount(page, balance);
  await page.getByTestId('onboarding-start').click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
}

/** Loads the demo data through Settings (only offered while there are no transactions). */
export async function loadDemoData(page: Page): Promise<void> {
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('settings-screen')).toBeVisible();
  await page.getByTestId('row-demo').click();
  await expect(page.getByTestId('row-demo')).toBeHidden({ timeout: 20_000 });
  await page.getByTestId('back-button').click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.locator('.toast')).toBeHidden({ timeout: 10_000 });
}

export async function shot(page: Page, folder: string, name: string): Promise<void> {
  await page.waitForTimeout(700); // let animations settle
  await page.screenshot({ path: `screenshots/${folder}/${name}.png`, fullPage: false });
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

/** Types an amount on the in-app keypad, e.g. "12.50". */
export async function typeAmount(page: Page, text: string): Promise<void> {
  for (const ch of text) await page.getByTestId(ch === '.' ? 'key-dot' : `key-${ch}`).click();
}
