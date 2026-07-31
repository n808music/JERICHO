import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the app
    await page.goto('http://localhost:5183', { waitUntil: 'networkidle' });

    // Wait for the page to fully load
    await page.waitForTimeout(3000);

    // Take a screenshot of the viewport
    await page.screenshot({ path: '/tmp/jericho_screenshot_1.png', fullPage: true });
    console.log('Screenshot 1 saved: /tmp/jericho_screenshot_1.png');

    // Try to navigate to Master Grid Tab
    // Look for a navigation element or button
    const masterGridButton = await page.$('text=Master Grid');
    if (masterGridButton) {
      await masterGridButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/jericho_screenshot_2.png', fullPage: true });
      console.log('Screenshot 2 saved: /tmp/jericho_screenshot_2.png (Master Grid Tab)');
    } else {
      console.log('Master Grid button not found, trying alternative');
      // Try tab selection
      const tabs = await page.locator('[data-testid*="tab"]').all();
      console.log(`Found ${tabs.length} tab elements`);

      // Look for mastergrid selector
      const gridScope = await page.$('[data-testid="mastergrid-scope-selector"]');
      if (gridScope) {
        console.log('Found mastergrid-scope-selector');
        await page.screenshot({ path: '/tmp/jericho_screenshot_2.png', fullPage: true });
        console.log('Screenshot 2 saved: /tmp/jericho_screenshot_2.png (Master Grid Tab)');
      }
    }

    // Scroll down to see if there are any residual questions or recommendations
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/jericho_screenshot_3.png', fullPage: true });
    console.log('Screenshot 3 saved: /tmp/jericho_screenshot_3.png (scrolled)');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
