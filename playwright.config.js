// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  retries: 1,
  use: {
    baseURL: 'https://www.browserstack.com',
    headless: true,
    viewport: { width: 1280, height: 720 },
    storageState: process.env.STORAGE_STATE_PATH || undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
