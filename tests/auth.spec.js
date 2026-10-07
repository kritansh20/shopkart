// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage so we start unauthenticated
    await page.context().clearCookies();
    await page.goto('/login');
  });

  test('successful login with demo credentials redirects to /products', async ({ page }) => {
    await page.fill('input[type="email"]', 'demo@shopkart.dev');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/products/);
  });

  test('wrong credentials shows error message', async ({ page }) => {
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('p.error')).toBeVisible();
  });

  test('wrong password for valid email shows error', async ({ page }) => {
    await page.fill('input[type="email"]', 'demo@shopkart.dev');
    await page.fill('input[type="password"]', 'badpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('p.error')).toBeVisible();
  });
});

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/register');
  });

  test('register with valid data navigates to /products', async ({ page }) => {
    const unique = `user_${Date.now()}@test.dev`;
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', unique);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/products/);
  });

  test('register with duplicate email shows error', async ({ page }) => {
    // demo@shopkart.dev is seeded — registering again should fail
    await page.fill('input[type="text"]', 'Demo User');
    await page.fill('input[type="email"]', 'demo@shopkart.dev');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');
    await expect(page.locator('p.error')).toBeVisible();
  });

  test('register with short password shows validation', async ({ page }) => {
    await page.fill('input[type="text"]', 'Short Pass');
    await page.fill('input[type="email"]', `short_${Date.now()}@test.dev`);
    await page.fill('input[type="password"]', 'abc');
    await page.click('button[type="submit"]');
    // minLength=6 triggers browser native validation or server error
    const errorVisible = await page.locator('p.error').isVisible();
    const passwordInvalid = await page.locator('input[type="password"]:invalid').count();
    expect(errorVisible || passwordInvalid > 0).toBeTruthy();
  });

  test('register form requires name field', async ({ page }) => {
    await page.fill('input[type="email"]', `noname_${Date.now()}@test.dev`);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    // Native required validation prevents submission
    const nameInvalid = await page.locator('input[type="text"]:invalid').count();
    expect(nameInvalid).toBeGreaterThan(0);
  });

  test('register form requires email field', async ({ page }) => {
    await page.fill('input[type="text"]', 'No Email');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    const emailInvalid = await page.locator('input[type="email"]:invalid').count();
    expect(emailInvalid).toBeGreaterThan(0);
  });

  test('register form requires password field', async ({ page }) => {
    await page.fill('input[type="text"]', 'No Password');
    await page.fill('input[type="email"]', `nopwd_${Date.now()}@test.dev`);
    await page.click('button[type="submit"]');
    const pwdInvalid = await page.locator('input[type="password"]:invalid').count();
    expect(pwdInvalid).toBeGreaterThan(0);
  });
});
