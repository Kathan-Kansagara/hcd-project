import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-screenshots-website');

const PORTS = [5174, 5177, 5175, 5176];

test('navbar logo close-up - BIO SCIENCE visibility', async ({ page }) => {
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

  const nav = page.locator('nav').first();
  await nav.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'navbar-logo-cropped.png'),
  });
});
