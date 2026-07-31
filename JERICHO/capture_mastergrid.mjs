import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the app
    await page.goto('http://localhost:5183', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Sign in with test credentials
    await page.fill('input[type="text"]', 'james');
    await page.fill('input[type="password"]', 'test123');
    // Try to find and click the create account button
    const createBtn = await page.$('button:has-text("Create account")');
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(3000);
      console.log('Created account');
    } else {
      console.log('Create button not found');
    }

    // After login, look for workspace or master grid
    await page.waitForTimeout(2000);

    // Try to find the Master Grid tab selector
    const scopeSelector = await page.$('[data-testid="mastergrid-scope-selector"]');
    if (scopeSelector) {
      console.log('Found Master Grid scope selector');
      // Take a screenshot showing the Master Grid
      await page.screenshot({ path: '/tmp/jericho_mastergrid_1.png', fullPage: true });
      console.log('Screenshot saved: /tmp/jericho_mastergrid_1.png');

      // Check if there are residual questions
      const residual = await page.$('[data-testid="mastergrid-residual"]');
      if (residual) {
        console.log('Found residual questions section');
        // Scroll to it and take a screenshot
        await residual.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/jericho_mastergrid_residual.png', fullPage: true });
        console.log('Screenshot saved: /tmp/jericho_mastergrid_residual.png');
      }

      // Check for phase recommendations
      const recs = await page.$('[data-testid="mastergrid-phase-recommendations"]');
      if (recs) {
        console.log('Found phase recommendations section');
        await recs.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/jericho_mastergrid_recommendations.png', fullPage: true });
        console.log('Screenshot saved: /tmp/jericho_mastergrid_recommendations.png');
      }
    } else {
      console.log('Master Grid not found in this view');
      // Just take a screenshot of current state
      await page.screenshot({ path: '/tmp/jericho_current_state.png', fullPage: true });
      console.log('Screenshot saved: /tmp/jericho_current_state.png');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
