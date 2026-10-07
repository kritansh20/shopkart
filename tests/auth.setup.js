const { test: setup, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const STORAGE_STATE = process.env.STORAGE_STATE_PATH || 'tests/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Reuse existing session if available and valid
  const storagePath = STORAGE_STATE;
  if (process.env.STORAGE_STATE_PATH && fs.existsSync(storagePath)) {
    await page.context().addCookies([]);
    // Try to validate the existing session
    try {
      await page.goto('/products');
      const isAuthenticated = await page.locator('nav').isVisible();
      if (isAuthenticated) return; // session still valid
    } catch {
      // fall through to fresh login
    }
  }

  const email = process.env.TEST_USER || 'demo@shopkart.dev';
  const password = process.env.TEST_PASS || 'demo1234';

  await page.goto('/');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/products/);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  await page.context().storageState({ path: storagePath });
});
