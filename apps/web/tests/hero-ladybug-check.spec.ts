import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-screenshots-website');

test('hero section ladybug scroll indicator', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const ports = [5174, 5177, 5175, 5176];
  let loaded = false;
  for (const port of ports) {
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
  await page.waitForTimeout(3000);

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'hero-ladybug-indicator.png'),
    fullPage: false,
  });
});
