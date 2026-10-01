import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}/finance-web/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'webkit-iphone',
      use: { ...devices['iPhone 14'], deviceScaleFactor: 2 },
      testIgnore: /offline/,
    },
    {
      name: 'chromium-offline',
      use: { ...devices['Pixel 7'], deviceScaleFactor: 2, launchOptions: { executablePath: '/opt/pw-browsers/chromium' } },
      testMatch: /offline/,
    },
  ],
  webServer: {
    command: 'node scripts/serve-docs.mjs',
    url: `http://localhost:${PORT}/finance-web/`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
