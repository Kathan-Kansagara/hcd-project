import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-screenshots-website');

const PORTS = [5174, 5177, 5175, 5176];

test('navbar logo zoomed - transparent and white states', async ({ page }) => {
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

  // State 1: Transparent navbar
  const metricsTransparent = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    const logoLink = document.querySelector('nav a[href="#"]');
    return {
      navHeight: nav ? nav.offsetHeight : null,
      logoContainer: logoLink ? `${logoLink.offsetWidth}x${logoLink.offsetHeight}` : null,
    };
  });

  const nav = page.locator('nav').first();
  await nav.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'logo-zoomed-transparent.png'),
  });

  // Scroll to trigger white navbar
  await page.evaluate(() => window.scrollTo(0, 150));
  await page.waitForTimeout(500);

  // State 2: White navbar
  const metricsWhite = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    const logoLink = document.querySelector('nav a[href="#"]');
    return {
      navHeight: nav ? nav.offsetHeight : null,
      logoContainer: logoLink ? `${logoLink.offsetWidth}x${logoLink.offsetHeight}` : null,
    };
  });

  await nav.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'logo-zoomed-white.png'),
  });

  console.log('\n=== TRANSPARENT NAVBAR ===');
  console.log('Navbar height:', metricsTransparent.navHeight, 'px');
  console.log('Logo container:', metricsTransparent.logoContainer);

  console.log('\n=== WHITE NAVBAR ===');
  console.log('Navbar height:', metricsWhite.navHeight, 'px');
  console.log('Logo container:', metricsWhite.logoContainer);
});
