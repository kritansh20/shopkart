// @ts-check
const { test, expect } = require('@playwright/test');

// Helper: log in programmatically via localStorage JWT
async function loginAs(page, email = 'demo@shopkart.dev', password = 'demo1234') {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/products/);
}

// ---------------------------------------------------------------------------
// Cart page
// ---------------------------------------------------------------------------
test.describe('Cart page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('cart page loads and shows items or empty state', async ({ page }) => {
    await page.goto('/cart');
    // Either a list of items or the empty-state message must be present
    const hasList = await page.locator('ul.cart-list').isVisible().catch(() => false);
    const hasEmpty = await page.locator('p.muted').filter({ hasText: 'Your cart is empty' }).isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test('empty cart shows empty state with browse link', async ({ page }) => {
    // Intercept GET /api/cart to return an empty cart
    await page.route('**/api/cart', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total_cents: 0, count: 0 }),
      });
    });
    await page.goto('/cart');
    await expect(page.locator('p.muted')).toContainText('Your cart is empty');
    await expect(page.locator('a', { hasText: 'Browse products' })).toBeVisible();
  });

  test('cart page shows items when cart has products', async ({ page }) => {
    await page.route('**/api/cart', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 1,
              product_id: 10,
              name: 'Widget A',
              image: '📦',
              price_cents: 1999,
              quantity: 2,
            },
          ],
          total_cents: 3998,
          count: 2,
        }),
      });
    });
    await page.goto('/cart');
    await expect(page.locator('ul.cart-list')).toBeVisible();
    await expect(page.locator('li.cart-row')).toHaveCount(1);
    await expect(page.locator('li.cart-row')).toContainText('Widget A');
  });

  test('change quantity of a cart item calls PATCH /api/cart/:id', async ({ page }) => {
    let patchCalled = false;
    await page.route('**/api/cart', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: 1, product_id: 10, name: 'Widget A', image: '📦', price_cents: 1999, quantity: 2 }],
          total_cents: 3998,
          count: 2,
        }),
      });
    });
    await page.route('**/api/cart/10', (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ id: 1, product_id: 10, name: 'Widget A', image: '📦', price_cents: 1999, quantity: 3 }],
            total_cents: 5997,
            count: 3,
          }),
        });
      } else {
        route.continue();
      }
    });
    await page.goto('/cart');
    // Click the "+" button to increase quantity
    await page.locator('li.cart-row').first().locator('button.btn-ghost', { hasText: '+' }).click();
    expect(patchCalled).toBe(true);
  });

  test('remove item from cart calls DELETE /api/cart/:id', async ({ page }) => {
    let deleteCalled = false;
    await page.route('**/api/cart', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: 1, product_id: 10, name: 'Widget A', image: '📦', price_cents: 1999, quantity: 1 }],
          total_cents: 1999,
          count: 1,
        }),
      });
    });
    await page.route('**/api/cart/10', (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total_cents: 0, count: 0 }),
        });
      } else {
        route.continue();
      }
    });
    await page.goto('/cart');
    await page.locator('li.cart-row').first().locator('button.danger', { hasText: 'Remove' }).click();
    expect(deleteCalled).toBe(true);
  });

  test('checkout requires address field (native validation)', async ({ page }) => {
    await page.route('**/api/cart', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: 1, product_id: 10, name: 'Widget A', image: '📦', price_cents: 1999, quantity: 1 }],
          total_cents: 1999,
          count: 1,
        }),
      });
    });
    await page.goto('/cart');
    // Submit without filling address
    await page.locator('button.btn-primary').click();
    // textarea has required attribute — browser prevents submission
    const textareaInvalid = await page.locator('textarea:invalid').count();
    expect(textareaInvalid).toBeGreaterThan(0);
  });

  test('successful checkout navigates to /orders with success message', async ({ page }) => {
    await page.route('**/api/cart', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: 1, product_id: 10, name: 'Widget A', image: '📦', price_cents: 1999, quantity: 1 }],
          total_cents: 1999,
          count: 1,
        }),
      });
    });
    await page.route('**/api/orders', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ order: { id: 42 } }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ orders: [] }),
        });
      }
    });
    await page.goto('/cart');
    await page.fill('textarea', '221B Baker Street, London NW1 6XE');
    await page.locator('button.btn-primary').click();
    await expect(page).toHaveURL(/\/orders/);
    await expect(page.locator('p.notice.success')).toContainText('Order #42 placed');
  });
});

// ---------------------------------------------------------------------------
// Orders page
// ---------------------------------------------------------------------------
test.describe('Orders page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('orders page shows order history', async ({ page }) => {
    await page.route('**/api/orders', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orders: [
            {
              id: 7,
              status: 'pending',
              created_at: '2024-01-15 10:00:00',
              address: '221B Baker Street',
              total_cents: 3998,
              items: [{ id: 1, name: 'Widget A', quantity: 2, price_cents: 1999 }],
            },
          ],
        }),
      });
    });
    await page.goto('/orders');
    await expect(page.locator('ul.order-list')).toBeVisible();
    await expect(page.locator('li.order')).toHaveCount(1);
    await expect(page.locator('li.order')).toContainText('Order #7');
    await expect(page.locator('span.pill')).toContainText('pending');
    await expect(page.locator('li.order')).toContainText('Widget A');
  });

  test('orders page shows empty state when no orders', async ({ page }) => {
    await page.route('**/api/orders', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orders: [] }),
      });
    });
    await page.goto('/orders');
    await expect(page.locator('p.muted')).toContainText('You have not placed any orders yet');
    await expect(page.locator('a', { hasText: 'Start shopping' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated access (ProtectedRoute redirects to /login)
// ---------------------------------------------------------------------------
test.describe('Unauthenticated access', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored auth state so the user is signed out
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('unauthenticated access to /cart redirects to /login', async ({ page }) => {
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated access to /orders redirects to /login', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
  });
});
