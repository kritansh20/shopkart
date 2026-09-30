// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * T-240926769 — Page load performance is within acceptable limits
 * Navigate to https://www.browserstack.com, measure page load time,
 * assert interactive within 5 seconds, verify no 4xx/5xx resource errors.
 */
test('T-240926769 — Page load performance is within acceptable limits', async ({ page }) => {
  const failedResources = [];

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    // Only flag document/script/style/fetch resources (skip tracking pixels etc.)
    if (status >= 400 && status < 600) {
      failedResources.push({ url, status });
    }
  });

  const startTime = Date.now();
  await page.goto('https://www.browserstack.com', { waitUntil: 'domcontentloaded' });

  // Measure time to interactive (domcontentloaded)
  const loadTime = Date.now() - startTime;

  // Assert page becomes interactive within 5 seconds
  expect(loadTime, `Page load time ${loadTime}ms exceeded 5000ms`).toBeLessThan(5000);

  // Assert no critical 4xx/5xx errors on the main document
  const criticalFailures = failedResources.filter(r =>
    r.url.includes('browserstack.com') && !r.url.includes('analytics') && !r.url.includes('tracking')
  );
  expect(
    criticalFailures,
    `Critical resources returned errors: ${JSON.stringify(criticalFailures)}`
  ).toHaveLength(0);
});

/**
 * T-290638049 — 404 page is displayed for non-existent URLs
 * Navigate to a non-existent URL and assert a 404 error page is displayed.
 */
test('T-290638049 — 404 page is displayed for non-existent URLs', async ({ page }) => {
  let responseStatus = null;

  page.on('response', (response) => {
    if (response.url().includes('/this-page-does-not-exist-xyz')) {
      responseStatus = response.status();
    }
  });

  await page.goto('https://www.browserstack.com/this-page-does-not-exist-xyz', {
    waitUntil: 'domcontentloaded',
  });

  // Assert HTTP 404 status was returned
  expect(responseStatus).toBe(404);

  // Assert the 404 error page content is visible
  // Evidence: strong element text "Error code 404" observed in DOM session
  await expect(page.locator('strong').filter({ hasText: 'Error code 404' })).toBeVisible();

  // Assert page title indicates not found
  await expect(page).toHaveTitle(/Page not found/i);
});

/**
 * T-330652637 — Free Trial CTA button navigates to sign-up page
 * Click the FREE TRIAL link in the top nav and assert redirect to /users/sign_up.
 */
test('T-330652637 — Free Trial CTA button navigates to sign-up page', async ({ page }) => {
  await page.goto('https://www.browserstack.com', { waitUntil: 'domcontentloaded' });

  // Evidence: a.bstack-mm-link.bstack-mm-cta-white.bstack-mm-main-link-free-trial observed in Step 2
  const freeTrialLink = page.locator('a.bstack-mm-link.bstack-mm-cta-white.bstack-mm-main-link-free-trial');
  await expect(freeTrialLink).toBeVisible();

  await freeTrialLink.click();

  // Assert URL contains /users/sign_up
  await expect(page).toHaveURL(/\/users\/sign_up/);
});
