// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');

// Only use storageState if the env var is set AND the file actually exists
const storageStatePath = (() => {
  const p = process.env.STORAGE_STATE_PATH;
  if (!p) return undefined;
  try { fs.accessSync(p); return p; } catch { return undefined; }
})();

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'https://bstackdemo.com',
    headless: true,
    storageState: storageStatePath,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
