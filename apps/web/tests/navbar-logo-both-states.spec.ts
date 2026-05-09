import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-screenshots-website');

const PORTS = [5174, 5177, 5175, 5176];

test('navbar logo in transparent and white states', async ({ page }) => {
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

  // State 1: Transparent navbar (hero at top)
  const metricsTransparent = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    const img = document.querySelector('nav img');
    return {
      navHeight: nav ? nav.offsetHeight : null,
      logoDimensions: img ? `${img.offsetWidth}x${img.offsetHeight}` : null,
    };
  });

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'logo-transparent-bg.png'),
    fullPage: false,
  });

  // Scroll down to trigger white navbar (scroll > 80px)
  await page.evaluate(() => window.scrollTo(0, 150));
  await page.waitForTimeout(500);

  // State 2: White/solid navbar
  const metricsWhite = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    const img = document.querySelector('nav img');
    return {
      navHeight: nav ? nav.offsetHeight : null,
      logoDimensions: img ? `${img.offsetWidth}x${img.offsetHeight}` : null,
    };
  });

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'logo-white-bg.png'),
    fullPage: false,
  });

  console.log('\n=== TRANSPARENT NAVBAR (hero) ===');
  console.log('Navbar height:', metricsTransparent.navHeight, 'px');
  console.log('Logo dimensions:', metricsTransparent.logoDimensions);

  console.log('\n=== WHITE NAVBAR (scrolled) ===');
  console.log('Navbar height:', metricsWhite.navHeight, 'px');
  console.log('Logo dimensions:', metricsWhite.logoDimensions);
});
