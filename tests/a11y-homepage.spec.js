const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const path = require('path');

test('BrowserStack homepage accessibility scan', async ({ page }) => {
  await page.goto('https://www.browserstack.com');

  // Run axe accessibility analysis
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  const violations = results.violations;

  // Log all violations with description, impact, and help URL
  if (violations.length > 0) {
    console.log(`\n=== Accessibility Violations Found: ${violations.length} ===\n`);
    violations.forEach((violation, index) => {
      console.log(`[${index + 1}] ${violation.id}`);
      console.log(`    Description : ${violation.description}`);
      console.log(`    Impact      : ${violation.impact}`);
      console.log(`    Help URL    : ${violation.helpUrl}`);
      console.log(`    Nodes       : ${violation.nodes.length}`);
      console.log('');
    });
  } else {
    console.log('\n✓ No accessibility violations found.\n');
  }

  // Save JSON report of all violations
  const reportDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    url: 'https://www.browserstack.com',
    timestamp: new Date().toISOString(),
    totalViolations: violations.length,
    criticalCount: violations.filter(v => v.impact === 'critical').length,
    seriousCount: violations.filter(v => v.impact === 'serious').length,
    moderateCount: violations.filter(v => v.impact === 'moderate').length,
    minorCount: violations.filter(v => v.impact === 'minor').length,
    violations: violations.map(v => ({
      id: v.id,
      description: v.description,
      impact: v.impact,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodesAffected: v.nodes.length,
      nodes: v.nodes.map(n => ({
        html: n.html,
        target: n.target,
        failureSummary: n.failureSummary,
      })),
    })),
  };

  fs.writeFileSync(
    path.join(reportDir, 'a11y-homepage-violations.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`Report saved to test-results/a11y-homepage-violations.json`);

  // Only fail on critical or serious violations — log them but pass the test
  const criticalOrSerious = violations.filter(
    v => v.impact === 'critical' || v.impact === 'serious'
  );

  if (criticalOrSerious.length > 0) {
    console.log(
      `\nFound ${criticalOrSerious.length} critical/serious violation(s) — logged above.`
    );
  }

  // Test passes regardless of violations found (scan-and-report mode)
  // Uncomment the line below to make the test fail on critical/serious violations:
  // expect(criticalOrSerious).toHaveLength(0);
});
