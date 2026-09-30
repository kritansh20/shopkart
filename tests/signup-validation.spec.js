// @ts-check
const { test, expect } = require('playwright/test');

const SIGNUP_URL = '/users/sign_up';

// Selectors observed from live site exploration
const SELECTORS = {
  nameInput: '#user_full_name',
  emailInput: '#user_email_login',
  passwordInput: '#user_password',
  submitButton: '#user_submit',
  // Scoped to signup form to avoid duplicate ids from the #enterprise_sign_in section
  nameError: '#signin_signup_form #full-name-error',
  emailError: '#signin_signup_form #email-error',
  passwordError: '#signin_signup_form #password-error',
};

// Helper: check the ToS checkbox (it is visually hidden; use JS to check it)
async function checkToS(page) {
  await page.evaluate(() => {
    const cb = document.querySelector('#tnc_checkbox');
    if (cb && !cb.checked) {
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      cb.dispatchEvent(new Event('click', { bubbles: true }));
    }
  });
}

// T-673737455 — Sign-up with already registered email shows error
test('T-673737455: Sign-up with already registered email shows error', async ({ page }) => {
  await page.goto(SIGNUP_URL);

  // Verify sign-up form is displayed
  await expect(page.getByRole('heading', { name: 'Create a FREE Account' })).toBeVisible();

  // Fill in an already-registered email with other required fields
  await page.fill(SELECTORS.nameInput, 'Test User');
  await page.fill(SELECTORS.emailInput, 'demo@browserstack.com');
  await page.fill(SELECTORS.passwordInput, 'TestPass123!');

  // Check the ToS checkbox (required for form submission)
  await checkToS(page);

  // Click submit — triggers AJAX email validation
  await page.click(SELECTORS.submitButton);

  // BrowserStack detects the registered email and switches the form to sign-in mode.
  // The submit button value changes to "Sign me in" when the AJAX completes.
  await expect(page.locator('#user_submit[value="Sign me in"]')).toBeVisible({ timeout: 30000 });
});

// T-543369397 — Sign-up form rejects invalid email format
test('T-543369397: Sign-up form rejects invalid email format', async ({ page }) => {
  await page.goto(SIGNUP_URL);

  // Verify sign-up form is displayed
  await expect(page.getByRole('heading', { name: 'Create a FREE Account' })).toBeVisible();

  // Fill email with invalid format
  await page.fill(SELECTORS.emailInput, 'invalid-email');

  // Trigger blur via JS evaluate — dispatching native blur event fires the jQuery validation handler
  // (observed in live browser: this immediately shows the email error without AJAX)
  await page.evaluate(() => {
    const el = document.querySelector('#user_email_login');
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  });

  // Assert email validation error is visible
  const emailError = page.locator(SELECTORS.emailError);
  await expect(emailError).toBeVisible();
  await expect(emailError).toContainText('Invalid Email');
});

// T-249299613 — Sign-up form validates required fields
test('T-249299613: Sign-up form validates required fields', async ({ page }) => {
  await page.goto(SIGNUP_URL);

  // Verify sign-up form is displayed
  await expect(page.getByRole('heading', { name: 'Create a FREE Account' })).toBeVisible();

  // Leave all fields empty and click submit
  await page.click(SELECTORS.submitButton);

  // Assert validation errors appear for name and password
  const nameError = page.locator(SELECTORS.nameError);
  const passwordError = page.locator(SELECTORS.passwordError);

  await expect(nameError).toBeVisible();
  await expect(passwordError).toBeVisible();

  // Name error: "At least 3 characters" (observed from live site)
  await expect(nameError).toContainText('At least 3 characters');
  // Password error: "At least 6 characters" (observed from live site)
  await expect(passwordError).toContainText('At least 6 characters');
});
