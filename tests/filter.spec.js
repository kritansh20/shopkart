// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Helper: log in to bstackdemo.com using the React-Select dropdowns.
 * Credentials: demouser / testingisfun99
 */
async function login(page) {
  await page.goto('https://bstackdemo.com/signin');

  // Open username React-Select (composite widget — needs mousedown on control div)
  await page.evaluate(() => {
    const ctrl = document.querySelector('#react-select-2-input')
      .closest('[class*="container"]')
      .querySelector('[class*="control"]');
    ctrl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    ctrl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    ctrl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForSelector('#react-select-2-option-0-0', { state: 'attached' });
  await page.evaluate(() => document.getElementById('react-select-2-option-0-0').click());

  // Open password React-Select
  await page.evaluate(() => {
    const ctrl = document.querySelector('#react-select-3-input')
      .closest('[class*="container"]')
      .querySelector('[class*="control"]');
    ctrl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    ctrl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    ctrl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForSelector('#react-select-3-option-0-0', { state: 'attached' });
  await page.evaluate(() => document.getElementById('react-select-3-option-0-0').click());

  await page.locator('#login-btn').click();
  await page.waitForURL('**/?signin=true', { timeout: 10000 });
}

test.describe('Product Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('filter by Apple vendor shows only Apple products', async ({ page }) => {
    // Initially 25 products are shown
    await expect(page.locator('h3').filter({ hasText: 'Product(s) found.' })).toContainText('25');

    // Custom checkmark span intercepts pointer events — use JS click to bypass overlay
    await page.evaluate(() => document.querySelector('input[value="Apple"]').click());
    await page.waitForTimeout(500);

    // Verify the count reduced
    const productCount = await page.locator('.shelf-item').count();
    expect(productCount).toBeGreaterThan(0);
    expect(productCount).toBeLessThan(25);

    // All visible product names should contain "iPhone"
    const productNames = await page.locator('.shelf-item__title').allTextContents();
    for (const name of productNames) {
      expect(name).toMatch(/iPhone/i);
    }
  });

  test('filter by Samsung vendor shows only Samsung products', async ({ page }) => {
    // Custom checkmark span intercepts pointer events — use JS click to bypass overlay
    await page.evaluate(() => document.querySelector('input[value="Samsung"]').click());
    await page.waitForTimeout(500);

    const productCount = await page.locator('.shelf-item').count();
    expect(productCount).toBeGreaterThan(0);
    expect(productCount).toBeLessThan(25);

    const productNames = await page.locator('.shelf-item__title').allTextContents();
    for (const name of productNames) {
      expect(name).toMatch(/Galaxy/i);
    }
  });

  test('filter by multiple vendors combines results', async ({ page }) => {
    // Custom checkmark span intercepts pointer events — use JS click to bypass overlay
    await page.evaluate(() => document.querySelector('input[value="Apple"]').click());
    await page.waitForTimeout(400);
    const appleCount = await page.locator('.shelf-item').count();

    // Uncheck Apple, check Samsung
    await page.evaluate(() => document.querySelector('input[value="Apple"]').click());
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('input[value="Samsung"]').click());
    await page.waitForTimeout(400);
    const samsungCount = await page.locator('.shelf-item').count();

    // Check both Apple + Samsung
    await page.evaluate(() => document.querySelector('input[value="Apple"]').click());
    await page.waitForTimeout(400);
    const combinedCount = await page.locator('.shelf-item').count();

    expect(combinedCount).toBe(appleCount + samsungCount);
  });

  test('sort by lowest to highest price reorders products', async ({ page }) => {
    await page.locator('select').selectOption('lowestprice');
    await page.waitForTimeout(500);

    // Collect integer prices from .val > b elements
    const prices = await page.locator('.shelf-item__price .val b').allTextContents();
    const numericPrices = prices.map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));

    for (let i = 1; i < numericPrices.length; i++) {
      expect(numericPrices[i]).toBeGreaterThanOrEqual(numericPrices[i - 1]);
    }
  });

  test('sort by highest to lowest price reorders products', async ({ page }) => {
    await page.locator('select').selectOption('highestprice');
    await page.waitForTimeout(500);

    const prices = await page.locator('.shelf-item__price .val b').allTextContents();
    const numericPrices = prices.map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));

    for (let i = 1; i < numericPrices.length; i++) {
      expect(numericPrices[i]).toBeLessThanOrEqual(numericPrices[i - 1]);
    }
  });
});
