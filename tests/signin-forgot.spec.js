// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('BrowserStack Sign-in and Forgot Password', () => {

  // T-843725160 — Forgot password link is accessible from sign-in page
  test('T-843725160: Forgot password link is accessible from sign-in page', async ({ page }) => {
    await page.goto('/users/sign_in');

    // Scope to #signin_signup_form to avoid strict-mode violation (two .forgot-password-link elements exist)
    // #signin_signup_form confirmed as parent container via DOM exploration
    const forgotLink = page.locator('#signin_signup_form a.forgot-password-link');
    await expect(forgotLink).toBeVisible();

    // Click the link
    await forgotLink.click();

    // Assert redirected to password reset page
    await expect(page).toHaveURL(/\/users\/password\/new/);
    await expect(page).toHaveTitle(/Reset your Password/);
  });

  // T-990921531 — Sign-in with invalid credentials shows error
  test('T-990921531: Sign-in with invalid credentials shows error', async ({ page }) => {
    await page.goto('/users/sign_in');

    // Wait for the sign-in form elements to be ready before using evaluate()
    await page.waitForSelector('#user_email_login', { state: 'visible' });

    // Fill credentials and submit via JS to bypass AJAX email-detection that switches to sign-up form
    await page.evaluate(() => {
      document.querySelector('#user_email_login').value = 'wrong@company.com';
      document.querySelector('#user_password').value = 'wrongpassword';
      document.querySelector('#user_submit').click();
    });

    // Assert error message is displayed — #password-error (role=alert) shows "Invalid password"
    const errorAlert = page.locator('#password-error');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
    await expect(errorAlert).toContainText('Invalid password');
  });

  // T-303514484 — Password reset email is sent for valid registered email
  test('T-303514484: Password reset email is sent for valid registered email', async ({ page }) => {
    await page.goto('/users/password/new');

    // Assert we are on the forgot password page
    await expect(page).toHaveTitle(/Reset your Password/);

    // Enter a valid-format email address
    await page.locator('#user_email_login').fill('test@example.com');

    // Click the Reset password button
    await page.locator('#reset_submit').click();

    // After submission, page redirects to sign-in and shows p.bs-alert-text[role="alert"]
    // Multiple alerts may appear; use first() to avoid strict-mode violation
    const confirmation = page.locator('p.bs-alert-text').first();
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(confirmation).toContainText('Password reset initiated');
  });

});
