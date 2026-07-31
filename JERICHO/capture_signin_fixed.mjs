import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('1. Navigating to app...');
    await page.goto('http://localhost:5183', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click the Sign in BUTTON (not the text)
    console.log('2. Clicking Sign in button...');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(1500);

    // Sign in as james
    console.log('3. Filling in credentials...');
    const userInput = await page.$('input[type="text"]');
    const passInput = await page.$('input[type="password"]');

    if (userInput && passInput) {
      await userInput.fill('james');
      await passInput.fill('test123');
      await page.waitForTimeout(500);

      // Get all buttons and find the login button
      const buttons = await page.getByRole('button').allTextContents();
      console.log('Available buttons:', buttons);

      // Click the first button that says something like "Sign in" or "Login"
      const signInBtn = await page.getByRole('button').filter({ hasText: /Sign in|Login/i }).first();
      const btnText = await signInBtn.textContent();
      console.log(`Clicking button: "${btnText}"`);
      await signInBtn.click();

      console.log('4. Waiting for login to complete...');
      await page.waitForTimeout(5000);

      // Check if we're logged in by looking for workspace elements
      const isLoggedIn = await page.locator('[data-testid*="workspace"], [data-testid*="grid"]').count() > 0;
      console.log(`Logged in successfully: ${isLoggedIn}`);

      // Take screenshot after login
      await page.screenshot({ path: '/tmp/after_signin.png', fullPage: true });
      console.log('✓ Screenshot 1: /tmp/after_signin.png');

      // Look for tabs or navigation
      const navItems = await page.locator('button, a').allTextContents();
      console.log('Navigation items:', navItems.filter(t => t.trim().length > 0 && t.length < 30));

      // Look for mastergrid content
      console.log('5. Looking for Master Grid content...');
      const gridCount = await page.locator('[data-testid*="mastergrid"]').count();
      console.log(`Master Grid elements found: ${gridCount}`);

      // Look for phase recommendations or residual sections
      const phaseRecCount = await page.locator('[data-testid="mastergrid-phase-recommendations"]').count();
      const residualCount = await page.locator('[data-testid="mastergrid-residual"]').count();
      console.log(`Phase recommendations sections: ${phaseRecCount}, Residual sections: ${residualCount}`);

      if (phaseRecCount > 0) {
        console.log('✓ Found phase recommendations section!');
        const recSection = await page.locator('[data-testid="mastergrid-phase-recommendations"]').first();
        await recSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);

        // Get the text content
        const recText = await recSection.textContent();
        console.log('Recommendations preview:', recText.substring(0, 150));

        await page.screenshot({ path: '/tmp/phase_recommendations_visible.png', fullPage: true });
        console.log('✓ Screenshot 2: /tmp/phase_recommendations_visible.png (Phase recommendations with rewritten messages)');
      } else if (residualCount > 0) {
        console.log('✓ Found residual questions section!');
        const resSection = await page.locator('[data-testid="mastergrid-residual"]').first();
        await resSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);

        const resText = await resSection.textContent();
        console.log('Residual preview:', resText.substring(0, 150));

        await page.screenshot({ path: '/tmp/residual_questions_visible.png', fullPage: true });
        console.log('✓ Screenshot 2: /tmp/residual_questions_visible.png (Residual questions with rewritten messages)');
      } else {
        console.log('No phase recommendations or residual sections found, taking general screenshot');
        await page.screenshot({ path: '/tmp/workspace_view.png', fullPage: true });
        console.log('✓ Screenshot 2: /tmp/workspace_view.png');
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
