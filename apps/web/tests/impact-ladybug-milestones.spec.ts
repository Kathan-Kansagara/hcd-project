import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-screenshots-website');

const PORTS = [5174, 5177, 5175, 5176];

test.describe('Impact section ladybug milestone nodes', () => {
  test('capture step 1, 2, 3 with ladybug on active node', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    let loaded = false;
    for (const port of PORTS) {
      try {
        const res = await page.goto(`http://localhost:${port}/`, {
          waitUntil: 'networkidle',
          timeout: 5000,
        });
        if (res?.ok()) {
          loaded = true;
          break;
        }
      } catch {
        continue;
      }
    }
    if (!loaded) throw new Error('Could not load website');

    await page.waitForTimeout(2000);

    // Scroll so #impact section top is at viewport top (step 1 active)
    await page.evaluate(() => {
      const el = document.getElementById('impact');
      if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    await page.waitForTimeout(1000);

    // Step 1: at start of section (activeStep 0)
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'impact-ladybug-step1.png'),
      fullPage: false,
    });

    // Scroll ~35% through pinned section for step 2 (activeStep 1)
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'impact-ladybug-step2.png'),
      fullPage: false,
    });

    // Scroll more for step 3 (activeStep 2) - stay within impact
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'impact-ladybug-step3.png'),
      fullPage: false,
    });
  });
});
