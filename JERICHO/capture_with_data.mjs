import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to app
    await page.goto('http://localhost:5183', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Sign up
    const userInput = await page.$('input[type="text"]');
    const passInput = await page.$('input[type="password"]');
    await userInput.fill('testuser');
    await passInput.fill('password123');
    
    const passConfirm = await page.locator('input[type="password"]').nth(1);
    await passConfirm.fill('password123');
    
    await page.waitForTimeout(500);
    const createBtn = await page.$('button:has-text("Create account")');
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(3000);
    }

    // Wait for app to load
    await page.waitForTimeout(2000);

    // Look for any navigation or workspace elements
    let screenshotCount = 0;

    // Try to find and click on workspace/tabs
    const workspaceLinks = await page.locator('a, button').allTextContents();
    console.log('Available navigation:', workspaceLinks.slice(0, 10));

    // Look for Master Grid or tab navigation
    const allButtons = await page.locator('button').all();
    console.log(`Found ${allButtons.length} buttons`);

    // Try clicking through tabs/navigation to find Master Grid
    for (let i = 0; i < Math.min(5, allButtons.length); i++) {
      const text = await allButtons[i].textContent();
      if (text && (text.includes('Grid') || text.includes('Master') || text.includes('Workspace'))) {
        console.log(`Clicking button: ${text}`);
        await allButtons[i].click();
        await page.waitForTimeout(1500);
        break;
      }
    }

    // Capture current state
    await page.screenshot({ path: '/tmp/jericho_after_login.png', fullPage: true });
    console.log('Screenshot saved: /tmp/jericho_after_login.png');

    // Look for the phase recommendations or residual sections
    const recsSection = await page.locator('[data-testid*="recommendation"], [data-testid*="residual"]').first();
    if (recsSection) {
      console.log('Found recommendations/residual section');
      await recsSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/jericho_messages.png', fullPage: true });
      console.log('Screenshot saved: /tmp/jericho_messages.png (with messages visible)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
