// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'https://www.browserstack.com',
    headless: false,
    viewport: { width: 1280, height: 720 },
    storageState: (() => { try { require('fs').accessSync(process.env.STORAGE_STATE_PATH || ''); return process.env.STORAGE_STATE_PATH; } catch { return undefined; } })(),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
