import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('1. Navigating to app...');
    await page.goto('http://localhost:5183', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click Create one link to go to create account
    console.log('2. Navigating to create account...');
    await page.getByRole('link', { name: 'Create one' }).click();
    await page.waitForTimeout(1500);

    // Create account "testuser2"
    console.log('3. Creating account...');
    const userInput = await page.$('input[type="text"]');
    const pass1Input = await page.locator('input[type="password"]').nth(0);
    const pass2Input = await page.locator('input[type="password"]').nth(1);

    if (userInput && pass1Input && pass2Input) {
      await userInput.fill('testuser2');
      await pass1Input.fill('test123');
      await pass2Input.fill('test123');

      // Click Create account button
      await page.getByRole('button', { name: 'Create account' }).click();
      console.log('Clicked Create account...');

      console.log('4. Waiting for account creation and navigation...');
      await page.waitForTimeout(6000);

      // Take screenshot of workspace
      await page.screenshot({ path: '/tmp/workspace_after_create.png', fullPage: true });
      console.log('✓ Screenshot 1: /tmp/workspace_after_create.png');

      // Look for Master Grid sections
      console.log('5. Looking for Master Grid sections...');

      // Check for phase recommendations
      const phaseRecSection = await page.locator('[data-testid="mastergrid-phase-recommendations"]');
      const hasPhaseRec = await phaseRecSection.count() > 0;
      console.log(`Has phase recommendations section: ${hasPhaseRec}`);

      // Check for residual sections
      const residualSection = await page.locator('[data-testid="mastergrid-residual"]');
      const hasResidual = await residualSection.count() > 0;
      console.log(`Has residual section: ${hasResidual}`);

      if (hasPhaseRec) {
        console.log('✓ Found PHASE RECOMMENDATIONS section');
        await phaseRecSection.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);

        // Get message content
        const msgText = await phaseRecSection.first().textContent();
        console.log('Message content (first 200 chars):', msgText.substring(0, 200));

        await page.screenshot({ path: '/tmp/STAGE2_SCREENSHOT.png', fullPage: true });
        console.log('✓✓✓ Screenshot saved to /tmp/STAGE2_SCREENSHOT.png (PHASE RECOMMENDATIONS VISIBLE)');
      } else if (hasResidual) {
        console.log('✓ Found RESIDUAL QUESTIONS section');
        await residualSection.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);

        const msgText = await residualSection.first().textContent();
        console.log('Message content (first 200 chars):', msgText.substring(0, 200));

        await page.screenshot({ path: '/tmp/STAGE2_SCREENSHOT.png', fullPage: true });
        console.log('✓✓✓ Screenshot saved to /tmp/STAGE2_SCREENSHOT.png (RESIDUAL QUESTIONS VISIBLE)');
      } else {
        console.log('No phase sections found yet, scrolling to check for messages...');

        // Scroll to look for any message content
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(1000);

        // Check again
        const msgCount = await page.locator('[data-testid*="phase"], [data-testid*="residual"]').count();
        console.log(`Found ${msgCount} message-related elements after scroll`);

        if (msgCount > 0) {
          await page.screenshot({ path: '/tmp/STAGE2_SCREENSHOT.png', fullPage: true });
          console.log('✓✓✓ Screenshot saved to /tmp/STAGE2_SCREENSHOT.png');
        } else {
          // Just capture the current state
          await page.screenshot({ path: '/tmp/STAGE2_SCREENSHOT.png', fullPage: true });
          console.log('✓✓✓ Screenshot saved to /tmp/STAGE2_SCREENSHOT.png (workspace view)');
        }
      }

    } else {
      console.log('ERROR: Could not find input fields');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await browser.close();
  }
})();
