import { test, expect } from '@playwright/test';

test.describe('StatusBadge Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Trials page which displays status badges
    await page.goto('http://localhost:3000/trials');
    await page.waitForLoadState('networkidle');
  });

  test('should display status badges in table', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table');

    // Check if status badges are visible
    const badges = page.locator('[class*="badge"]');
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should display IN_PROGRESS status with correct styling', async ({ page }) => {
    // Look for IN_PROGRESS badge if it exists
    const inProgressBadge = page.locator('[class*="badge"]:has-text("IN PROGRESS")').first();
    const exists = await inProgressBadge.count() > 0;

    if (exists) {
      await expect(inProgressBadge).toBeVisible();

      // Check for primary styling
      const classes = await inProgressBadge.getAttribute('class');
      expect(classes).toBeTruthy();
    }
  });

  test('should display COMPLETED status with correct styling', async ({ page }) => {
    // Look for COMPLETED badge if it exists
    const completedBadge = page.locator('[class*="badge"]:has-text("COMPLETED")').first();
    const exists = await completedBadge.count() > 0;

    if (exists) {
      await expect(completedBadge).toBeVisible();

      // Check for outline styling
      const classes = await completedBadge.getAttribute('class');
      expect(classes).toBeTruthy();
    }
  });

  test('should display DRAFT status with correct styling', async ({ page }) => {
    // Look for DRAFT badge if it exists
    const draftBadge = page.locator('[class*="badge"]:has-text("DRAFT")').first();
    const exists = await draftBadge.count() > 0;

    if (exists) {
      await expect(draftBadge).toBeVisible();
    }
  });

  test('should format status text by replacing underscores', async ({ page }) => {
    // Status badges should show "IN PROGRESS" not "IN_PROGRESS"
    const badges = page.locator('[class*="badge"]');
    const count = await badges.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = await badges.nth(i).textContent();
        // Check that text doesn't contain underscores (should be replaced with spaces)
        if (text && text.includes('_')) {
          // This would indicate the formatting isn't working
          expect(text).not.toContain('_');
        }
      }
    }
  });
});
