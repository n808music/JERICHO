import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5183', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Create simple test account
    const userInput = await page.$('input[type="text"]');
    const pass1 = await page.locator('input[type="password"]').nth(0);
    const pass2 = await page.locator('input[type="password"]').nth(1);

    if (userInput && pass1 && pass2) {
      await userInput.fill('testgrid');
      await pass1.fill('pass123');
      await pass2.fill('pass123');

      await page.getByRole('button', { name: 'Create account' }).click();
      await page.waitForTimeout(4000);

      // Take screenshot
      await page.screenshot({ path: '/tmp/STAGE2_SCREENSHOT_MESSAGES.png', fullPage: true });
      console.log('Screenshot saved');
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
