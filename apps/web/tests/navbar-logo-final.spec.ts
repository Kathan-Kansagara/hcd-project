import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-screenshots-website');

const PORTS = [5174, 5177, 5175, 5176];

test('navbar logo final verification', async ({ page }) => {
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

  const metrics = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    const img = document.querySelector('nav img');
    return {
      navHeight: nav ? nav.offsetHeight : null,
      logoDimensions: img ? `${img.offsetWidth}x${img.offsetHeight}` : null,
    };
  });

  const nav = page.locator('nav').first();
  await nav.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'navbar-logo-final.png'),
  });

  console.log('\n=== NAVBAR LOGO FINAL REPORT ===');
  console.log('Navbar height (offsetHeight):', metrics.navHeight, 'px');
  console.log('Logo dimensions (offsetWidth x offsetHeight):', metrics.logoDimensions);
});
