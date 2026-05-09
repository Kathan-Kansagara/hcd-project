/**
 * Visual comparison: Rebuilt website (dev 5174) vs reference (served dist 53631)
 * Ensures both render the same.
 *
 * Run: npx playwright test website-visual-compare
 * Screenshots saved to test-screenshots/ for manual comparison.
 */
import { test, expect } from '@playwright/test';

const REFERENCE_URL = 'http://localhost:53631/';
const REBUILT_URL = 'http://localhost:5174/';
const VIEWPORT = { width: 1440, height: 900 };

test.describe('Website visual comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
  });

  test('reference (53631) loads', async ({ page }) => {
    const response = await page.goto(REFERENCE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    expect(response?.status()).toBe(200);
  });

  test('rebuilt (5174) loads', async ({ page }) => {
    const response = await page.goto(REBUILT_URL, { waitUntil: 'networkidle', timeout: 15000 });
    expect(response?.status()).toBe(200);
  });

  test('hero - save screenshots for comparison', async ({ page }) => {
    await page.goto(REFERENCE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(5000);
    await page.screenshot({
      path: 'test-screenshots/compare-53631-hero.png',
    });

    await page.goto(REBUILT_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(5000);
    await page.screenshot({
      path: 'test-screenshots/compare-5174-hero.png',
    });
  });

  test('hero - rebuilt matches reference (within 15% diff)', async ({ page }) => {
    await page.goto(REFERENCE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(5000);
    await expect(page).toHaveScreenshot('website-hero.png', { maxDiffPixelRatio: 0.15 });

    await page.goto(REBUILT_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(5000);
    await expect(page).toHaveScreenshot('website-hero.png', { maxDiffPixelRatio: 0.15 });
  });

  test('full page - save screenshots for comparison', async ({ page }) => {
    await page.goto(REFERENCE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'test-screenshots/compare-53631-full.png',
      fullPage: true,
    });

    await page.goto(REBUILT_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'test-screenshots/compare-5174-full.png',
      fullPage: true,
    });
  });
});
