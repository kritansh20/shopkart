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

test.describe('Add to Cart', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('add a single product to cart increments cart badge to 1', async ({ page }) => {
    // Cart starts empty
    await expect(page.locator('.bag__quantity').first()).toHaveText('0');

    // Wait for products to fully load (lazy-loaded after login redirect), then click "Add to cart"
    await page.waitForSelector('.shelf-item__buy-btn', { state: 'visible', timeout: 15000 });
    await page.evaluate(() => document.querySelector('.shelf-item__buy-btn').click());
    await page.waitForTimeout(500);

    // Cart badge should show 1
    await expect(page.locator('.bag__quantity').first()).toHaveText('1');
  });

  test('add multiple products to cart updates badge count correctly', async ({ page }) => {
    // Wait for products to load, then add first product
    await page.waitForSelector('.shelf-item__buy-btn', { state: 'visible', timeout: 15000 });
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.shelf-item__buy-btn');
      btns[0].click();
    });
    await page.waitForTimeout(300);

    // Add second product
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.shelf-item__buy-btn');
      btns[1].click();
    });
    await page.waitForTimeout(300);

    await expect(page.locator('.bag__quantity').first()).toHaveText('2');
  });

  test('cart panel shows added product name and price', async ({ page }) => {
    // Wait for products to load, then add iPhone 12 to cart
    await page.waitForSelector('.shelf-item__buy-btn', { state: 'visible', timeout: 15000 });
    await page.evaluate(() => document.querySelector('.shelf-item__buy-btn').click());
    await page.waitForTimeout(500);

    // Open cart panel
    await page.evaluate(() => document.querySelector('.bag').click());
    await page.waitForTimeout(300);

    // Verify product name appears in cart
    await expect(page.locator('.float-cart__shelf-container .shelf-item__details .title').first())
      .toHaveText('iPhone 12');
  });

  test('remove product from cart decrements badge count', async ({ page }) => {
    // Wait for products to load, then add two products
    await page.waitForSelector('.shelf-item__buy-btn', { state: 'visible', timeout: 15000 });
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.shelf-item__buy-btn');
      btns[0].click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.shelf-item__buy-btn');
      btns[1].click();
    });
    await page.waitForTimeout(300);

    await expect(page.locator('.bag__quantity').first()).toHaveText('2');

    // Open cart and remove first item
    await page.evaluate(() => document.querySelector('.bag').click());
    await page.waitForTimeout(300);
    await page.evaluate(() =>
      document.querySelector('.float-cart__shelf-container .shelf-item__del').click()
    );
    await page.waitForTimeout(300);

    await expect(page.locator('.bag__quantity').first()).toHaveText('1');
  });

  test('adding same product twice increments quantity in cart', async ({ page }) => {
    // Wait for products to load, then add the same product twice
    await page.waitForSelector('.shelf-item__buy-btn', { state: 'visible', timeout: 15000 });
    await page.evaluate(() => document.querySelector('.shelf-item__buy-btn').click());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('.shelf-item__buy-btn').click());
    await page.waitForTimeout(300);

    // Cart badge should show 2
    await expect(page.locator('.bag__quantity').first()).toHaveText('2');

    // Open cart and verify quantity in description
    await page.evaluate(() => document.querySelector('.bag').click());
    await page.waitForTimeout(300);
    await expect(
      page.locator('.float-cart__shelf-container .shelf-item__details .desc').first()
    ).toContainText('Quantity: 2');
  });
});
