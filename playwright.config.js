// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:6001',
    trace: 'on-first-retry',
    storageState: (() => {
      const p = process.env.STORAGE_STATE_PATH;
      return p && fs.existsSync(p) ? p : undefined;
    })(),
  },

  projects: [
    // Auth setup project — runs first, establishes session
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
