// @ts-check
const { test } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');

test.describe('BrowserStack Homepage - WCAG 2.1 AA Accessibility', () => {
  test('should have no critical or serious accessibility violations', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000); // allow JS to settle

    // Run axe-core with WCAG 2.1 AA rules
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const violations = results.violations;

    // Log ALL violations with impact, rule id, and description
    console.log(`\n${'='.repeat(70)}`);
    console.log(`ACCESSIBILITY SCAN RESULTS — BrowserStack Homepage`);
    console.log(`Total violations found: ${violations.length}`);
    console.log(`${'='.repeat(70)}\n`);

    if (violations.length === 0) {
      console.log('✓ No accessibility violations found.\n');
    } else {
      violations.forEach((v, i) => {
        console.log(`[${i + 1}] Impact: ${v.impact?.toUpperCase() ?? 'UNKNOWN'}`);
        console.log(`    Rule ID   : ${v.id}`);
        console.log(`    Description: ${v.description}`);
        console.log(`    Help URL  : ${v.helpUrl}`);
        console.log(`    Affected  : ${v.nodes.length} element(s)`);
        v.nodes.slice(0, 3).forEach((node, ni) => {
          console.log(`      Element ${ni + 1}: ${node.html?.substring(0, 120)}`);
          if (node.failureSummary) {
            console.log(`      Fix: ${node.failureSummary.split('\n')[0]}`);
          }
        });
        console.log('');
      });
    }

    // Separate critical and serious violations
    const criticalOrSerious = violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    const moderate = violations.filter((v) => v.impact === 'moderate');
    const minor = violations.filter((v) => v.impact === 'minor');

    console.log(`${'='.repeat(70)}`);
    console.log(`SUMMARY`);
    console.log(`  Critical/Serious : ${criticalOrSerious.length}`);
    console.log(`  Moderate         : ${moderate.length}`);
    console.log(`  Minor            : ${minor.length}`);
    console.log(`${'='.repeat(70)}\n`);

    // Assert zero critical or serious violations
    if (criticalOrSerious.length > 0) {
      const details = criticalOrSerious
        .map((v) => `  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`)
        .join('\n');
      throw new Error(
        `Found ${criticalOrSerious.length} critical/serious accessibility violation(s):\n${details}`
      );
    }
  });
});
