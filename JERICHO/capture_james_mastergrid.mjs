import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('1. Navigating to app...');
    await page.goto('http://localhost:5183', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Look for Continue as James button
    console.log('2. Looking for "Continue as James" button...');
    const continueBtn = await page.locator('button:has-text("Continue as James")');
    const btnCount = await continueBtn.count();
    console.log(`Found ${btnCount} "Continue as James" button(s)`);

    if (btnCount > 0) {
      await continueBtn.first().click();
      console.log('3. Clicked Continue as James, waiting for profile load...');
      await page.waitForTimeout(4000);

      // Take screenshot of workspace
      await page.screenshot({ path: '/tmp/james_profile_loaded.png', fullPage: true });
      console.log('Saved: /tmp/james_profile_loaded.png');

      // Look for tabs or navigation to Master Grid
      console.log('4. Looking for Master Grid navigation...');

      // Try to find any buttons/links with "Grid", "Master", "Matrix"
      const allElements = await page.locator('button, a, [role="tab"]').allTextContents();
      console.log('Navigation items:', allElements.filter(t => t.trim().length > 0).slice(0, 15));

      // Try to click on a tab that might be Master Grid
      const tabButtons = await page.locator('[role="tab"], button').all();
      console.log(`5. Checking ${tabButtons.length} potential tab buttons...`);

      for (let i = 0; i < Math.min(10, tabButtons.length); i++) {
        const text = await tabButtons[i].textContent();
        if (text && (text.includes('Grid') || text.includes('Master') || text.includes('Phase') || text.includes('Matrix'))) {
          console.log(`Found matching tab: "${text}"`);
          await tabButtons[i].click();
          await page.waitForTimeout(2000);

          // Check if we now see Master Grid content
          const hasGrid = await page.locator('[data-testid*="mastergrid"]').first();
          if (hasGrid) {
            console.log('✓ Master Grid found!');
            break;
          }
        }
      }

      // Capture final state
      console.log('6. Capturing final screenshot...');
      await page.screenshot({ path: '/tmp/james_mastergrid_view.png', fullPage: true });
      console.log('Saved: /tmp/james_mastergrid_view.png');

      // Also try to scroll and capture any visible message sections
      const probeElements = await page.locator('[data-testid*="probe"], [data-testid*="recommendation"], [data-testid*="residual"]').all();
      console.log(`Found ${probeElements.length} potential message elements`);

      if (probeElements.length > 0) {
        console.log('7. Message sections found! Scrolling to first one...');
        await probeElements[0].scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/tmp/james_messages_visible.png', fullPage: true });
        console.log('Saved: /tmp/james_messages_visible.png (with messages)');
      }

    } else {
      console.log('Continue as James button not found');
      await page.screenshot({ path: '/tmp/debug_buttons.png', fullPage: true });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
