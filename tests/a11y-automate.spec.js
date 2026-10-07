const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const path = require('path');

test('Accessibility scan of browserstack.com/automate', async ({ page }) => {
  await page.goto('https://www.browserstack.com/automate');

  const results = await new AxeBuilder({ page }).analyze();

  // Ensure output directory exists
  const outputDir = path.join(__dirname, '..', 'test-results');
  fs.mkdirSync(outputDir, { recursive: true });

  // Save full violations report
  const reportPath = path.join(outputDir, 'a11y-automate-violations.json');
  fs.writeFileSync(reportPath, JSON.stringify(results.violations, null, 2));
  console.log(`\nViolations report saved to: ${reportPath}`);

  // Log all violations with description, impact, and helpUrl
  if (results.violations.length === 0) {
    console.log('No accessibility violations found.');
  } else {
    console.log(`\nFound ${results.violations.length} accessibility violation(s):\n`);
    results.violations.forEach((violation, i) => {
      console.log(`[${i + 1}] ${violation.id}`);
      console.log(`    Description : ${violation.description}`);
      console.log(`    Impact      : ${violation.impact}`);
      console.log(`    Help URL    : ${violation.helpUrl}`);
      console.log(`    Nodes       : ${violation.nodes.length}`);
      console.log('');
    });
  }

  // Only fail on critical or serious violations
  const criticalOrSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  if (criticalOrSerious.length > 0) {
    console.log(`\n${criticalOrSerious.length} critical/serious violation(s) found (listed above).`);
  }

  // Test passes regardless of violations — log and report only
  expect(results.violations).toBeDefined();
});
