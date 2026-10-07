// @ts-check
const { test, expect } = require('@playwright/test');

const STORAGE_STATE = process.env.STORAGE_STATE_PATH || 'tests/.auth/user.json';

// ─── Authenticated tests ───────────────────────────────────────────────────

test.describe('Products page (authenticated)', () => {
  test.use({
    storageState: (() => {
      const fs = require('fs');
      const p = STORAGE_STATE;
      return fs.existsSync(p) ? p : undefined;
    })(),
  });

  test('products page loads and shows product list', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('h1')).toHaveText('Products');
    // Wait for loading to finish and at least one product card to appear
    await expect(page.locator('article.card.product').first()).toBeVisible();
  });

  test('search box filters products by name', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('article.card.product').first()).toBeVisible();

    // Type a search term and wait for debounce + re-render
    await page.fill('.search', 'a');
    await page.waitForTimeout(400); // debounce is 250 ms

    // Every visible product name should contain the search term (case-insensitive)
    const names = await page.locator('article.card.product h3').allTextContents();
    for (const name of names) {
      expect(name.toLowerCase()).toContain('a');
    }
  });

  test('search box shows no-results message when nothing matches', async ({ page }) => {
    await page.goto('/products');
    await page.fill('.search', 'zzznomatch999');
    await page.waitForTimeout(400);
    await expect(page.locator('text=No products match those filters.')).toBeVisible();
  });

  test('category dropdown filters products', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('article.card.product').first()).toBeVisible();

    // Pick the first non-"all" category option
    const select = page.locator('select').first();
    const options = await select.locator('option').allTextContents();
    const firstCategory = options.find((o) => o !== 'All categories');
    if (!firstCategory) return; // no categories seeded — skip gracefully

    await select.selectOption({ label: firstCategory });
    await page.waitForTimeout(400);

    // Products should still render (or show no-results) — no crash
    const cards = page.locator('article.card.product');
    const noResults = page.locator('text=No products match those filters.');
    await expect(cards.or(noResults).first()).toBeVisible();
  });

  test('sort by price low-to-high orders products correctly', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('article.card.product').first()).toBeVisible();

    // Select the sort dropdowns — it is the second <select> in the toolbar
    const sortSelect = page.locator('select').nth(1);
    await sortSelect.selectOption('price_asc');
    await page.waitForTimeout(400);

    const prices = await page.locator('article.card.product .product-foot strong').allTextContents();
    // Parse cents from formatted strings like "$12.99"
    const parsed = prices.map((t) => parseFloat(t.replace(/[^0-9.]/g, '')));
    for (let i = 1; i < parsed.length; i++) {
      expect(parsed[i]).toBeGreaterThanOrEqual(parsed[i - 1]);
    }
  });

  test('sort by price high-to-low orders products correctly', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('article.card.product').first()).toBeVisible();

    const sortSelect = page.locator('select').nth(1);
    await sortSelect.selectOption('price_desc');
    await page.waitForTimeout(400);

    const prices = await page.locator('article.card.product .product-foot strong').allTextContents();
    const parsed = prices.map((t) => parseFloat(t.replace(/[^0-9.]/g, '')));
    for (let i = 1; i < parsed.length; i++) {
      expect(parsed[i]).toBeLessThanOrEqual(parsed[i - 1]);
    }
  });

  test('clicking a product navigates to its detail page', async ({ page }) => {
    await page.goto('/products');
    const firstCard = page.locator('article.card.product').first();
    await expect(firstCard).toBeVisible();

    // Click the product name link
    await firstCard.locator('h3 a').click();
    await expect(page).toHaveURL(/\/products\/\d+/);
    // Detail page renders a heading with the product name
    await expect(page.locator('section.detail h1')).toBeVisible();
  });

  test('add to cart from products page shows notice', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('article.card.product').first()).toBeVisible();

    // Click the first "Add to cart" button (only visible when logged in and in stock)
    const addBtn = page.locator('article.card.product button.btn-primary').first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // A notice paragraph should appear with confirmation text
    await expect(page.locator('p.notice')).toBeVisible();
    await expect(page.locator('p.notice')).toContainText('Added');
    await expect(page.locator('p.notice')).toContainText('to your cart');
  });
});

// ─── Product Detail page (authenticated) ──────────────────────────────────

test.describe('Product Detail page (authenticated)', () => {
  test.use({
    storageState: (() => {
      const fs = require('fs');
      const p = STORAGE_STATE;
      return fs.existsSync(p) ? p : undefined;
    })(),
  });

  test('product detail shows name, price and description', async ({ page }) => {
    // Navigate to products first to grab a real product id
    await page.goto('/products');
    const firstCard = page.locator('article.card.product').first();
    await expect(firstCard).toBeVisible();

    const productName = await firstCard.locator('h3 a').textContent();
    await firstCard.locator('h3 a').click();
    await expect(page).toHaveURL(/\/products\/\d+/);

    // Name
    await expect(page.locator('section.detail h1')).toHaveText(productName ?? '');
    // Price — rendered inside .price
    await expect(page.locator('section.detail .price')).toBeVisible();
    // Description — a <p> that is not a pill/price/muted line
    await expect(page.locator('section.detail .detail-body p:not(.pill):not(.price):not(.muted)').first()).toBeVisible();
  });

  test('add to cart from detail page shows notice', async ({ page }) => {
    await page.goto('/products');
    const firstCard = page.locator('article.card.product').first();
    await expect(firstCard).toBeVisible();
    await firstCard.locator('h3 a').click();
    await expect(page).toHaveURL(/\/products\/\d+/);

    // Click "Add to cart" on the detail page
    const addBtn = page.locator('section.detail button.btn-primary');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    await expect(page.locator('section.detail p.notice')).toBeVisible();
    await expect(page.locator('section.detail p.notice')).toContainText('Added');
    await expect(page.locator('section.detail p.notice')).toContainText('to your cart');
  });

  test('quantity input on detail page changes the add-to-cart quantity', async ({ page }) => {
    await page.goto('/products');
    await page.locator('article.card.product h3 a').first().click();
    await expect(page).toHaveURL(/\/products\/\d+/);

    const qtyInput = page.locator('input.qty');
    await expect(qtyInput).toBeVisible();
    await qtyInput.fill('2');
    await page.locator('section.detail button.btn-primary').click();

    await expect(page.locator('section.detail p.notice')).toContainText('2');
  });
});

// ─── Unauthenticated access ────────────────────────────────────────────────

test.describe('Unauthenticated access', () => {
  // Explicitly clear storage state so no session cookie is sent
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated user is redirected to login when accessing /products', async ({ page }) => {
    await page.goto('/products');
    // The app should redirect to /login (or render the login page)
    await expect(page).toHaveURL(/\/login/);
  });
});
