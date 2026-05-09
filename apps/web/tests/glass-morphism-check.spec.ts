import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-screenshots-website');

const PORTS = [5174, 5177, 5175, 5176];

test.describe('Glass-morphism styling verification', () => {
  test('capture navbar, products, footer glass elements', async ({ page }) => {
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

    // 1. Hero section - navbar at top (language toggle + Contact Us)
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'glass-01-navbar-hero.png'),
      fullPage: false,
    });

    // 2. Products section (#solutions)
    await page.locator('#solutions').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'glass-02-products.png'),
      fullPage: false,
    });

    // 3. Footer - newsletter subscribe area
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'glass-03-footer.png'),
      fullPage: false,
    });
  });
});
