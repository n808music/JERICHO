import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('1. Navigating to app...');
    await page.goto('http://localhost:5183', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click "Sign in" link
    console.log('2. Looking for Sign in link...');
    await page.locator('text=Sign in').click();
    await page.waitForTimeout(1500);

    // Sign in as james
    console.log('3. Signing in as james...');
    const userInput = await page.$('input[type="text"]');
    const passInput = await page.$('input[type="password"]');

    if (userInput && passInput) {
      await userInput.fill('james');
      await passInput.fill('test123');

      // Wait for sign in to complete
      await page.waitForTimeout(1000);

      // Look for sign in button (might be different after switching to sign in mode)
      const buttons = await page.locator('button').all();
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text.includes('Sign') || text.includes('Login') || text.includes('Continue')) {
          await btn.click();
          console.log('Clicked sign in button');
          break;
        }
      }

      await page.waitForTimeout(4000);

      // Take screenshot after login
      await page.screenshot({ path: '/tmp/after_signin.png', fullPage: true });
      console.log('Screenshot 1: /tmp/after_signin.png');

      // Now look for Master Grid or workspace navigation
      console.log('4. Looking for workspace...');

      // Look for the workspace/tabs area
      const allText = await page.textContent('body');
      if (allText.includes('Workspace') || allText.includes('Grid') || allText.includes('Master')) {
        console.log('✓ Found workspace content');
      }

      // Look for tab buttons
      const tabElements = await page.locator('button[class*="tab"], button[class*="Tab"]').allTextContents();
      console.log('Tab elements found:', tabElements);

      // Try to find any element mentioning "Master Grid"
      const gridElements = await page.locator('text=/Master|Grid/i').all();
      console.log(`Found ${gridElements.length} elements matching Master/Grid`);

      if (gridElements.length > 0) {
        console.log('✓ Master Grid section found, scrolling to it...');
        await gridElements[0].scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
      }

      // Scroll down to see more content
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1000);

      await page.screenshot({ path: '/tmp/workspace_content.png', fullPage: true });
      console.log('Screenshot 2: /tmp/workspace_content.png');

      // Look for message/question elements
      console.log('5. Looking for messages...');
      const msgElements = await page.locator('[data-testid*="phase-rec"], [data-testid*="residual"], [data-testid*="probe"]').all();
      console.log(`Found ${msgElements.length} message elements`);

      if (msgElements.length > 0) {
        console.log('✓ Messages found!');
        // Get the first message text
        const msgText = await msgElements[0].textContent();
        console.log('Message preview:', msgText.substring(0, 100));

        await msgElements[0].scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/messages_visible.png', fullPage: true });
        console.log('Screenshot 3: /tmp/messages_visible.png (messages section)');
      }

    } else {
      console.log('Could not find input fields');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
