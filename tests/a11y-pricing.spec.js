// @ts-check
const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');

test('Pricing page WCAG 2.1 AA accessibility scan', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/pricing');

  // Run axe-core with WCAG 2.1 AA tags
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations;

  // Log all violations regardless of severity
  if (violations.length === 0) {
    console.log('✅ No accessibility violations found.');
  } else {
    console.log(`\n⚠️  Total violations found: ${violations.length}\n`);
    for (const violation of violations) {
      console.log(`[${violation.impact?.toUpperCase()}] Rule: ${violation.id}`);
      console.log(`  Description: ${violation.description}`);
      console.log(`  Help: ${violation.helpUrl}`);
      console.log(`  Affected elements: ${violation.nodes.length}`);
      for (const node of violation.nodes) {
        console.log(`    - ${node.target.join(', ')}`);
        if (node.failureSummary) {
          console.log(`      ${node.failureSummary.split('\n')[0]}`);
        }
      }
      console.log('');
    }
  }

  // Filter critical and serious violations
  const criticalOrSerious = violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  if (criticalOrSerious.length > 0) {
    console.log(`\n❌ FAILING: ${criticalOrSerious.length} critical/serious violation(s) found:\n`);
    for (const v of criticalOrSerious) {
      console.log(`  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`);
    }
  }

  // Assert zero critical/serious violations
  expect(
    criticalOrSerious.length,
    `Found ${criticalOrSerious.length} critical/serious accessibility violation(s). See logs above for details.`
  ).toBe(0);
});
