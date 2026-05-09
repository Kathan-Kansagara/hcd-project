import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-screenshots-website');

const PORTS = [5174, 5177, 5175, 5176];

test('navbar logo and height verification', async ({ page }) => {
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

  // Measure navbar height
  const navHeight = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    return nav ? nav.offsetHeight : null;
  });

  // Measure logo dimensions
  const logoMetrics = await page.evaluate(() => {
    const img = document.querySelector('nav img[alt="Zenon Bio Science"]');
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      computedWidth: window.getComputedStyle(img).width,
      computedHeight: window.getComputedStyle(img).height,
    };
  });

  // Screenshot navbar
  const nav = page.locator('nav').first();
  await nav.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'navbar-logo-bigger.png'),
  });

  console.log('\n=== NAVBAR MEASUREMENTS ===');
  console.log('Navbar height (offsetHeight):', navHeight, 'px');
  console.log('Logo dimensions:', JSON.stringify(logoMetrics, null, 2));
});
