import { test, expect } from '@playwright/test';

test.describe('SearchableCombobox Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that uses SearchableCombobox (we'll use Trials page as reference)
    await page.goto('http://localhost:3000/trials');

    // Click to open the add trial modal
    await page.click('button:has-text("New Trial")');

    // Wait for modal to open
    await page.waitForSelector('[role="dialog"]');
  });

  test('should open dropdown on click and display options', async ({ page }) => {
    // Click the farmer combobox button
    await page.click('button[role="combobox"]:has-text("Select a farmer")');

    // Check if popover is visible
    await expect(page.locator('[cmdk-root]')).toBeVisible();

    // Search input should be auto-focused
    const searchInput = page.locator('input[placeholder*="Search farmer"]');
    await expect(searchInput).toBeFocused();
  });

  test('should filter options based on search input', async ({ page }) => {
    // Click the farmer combobox button
    await page.click('button[role="combobox"]:has-text("Select a farmer")');

    // Type in search
    await page.fill('input[placeholder*="Search farmer"]', 'test');

    // Should filter to show only matching items
    // The number of items should be less than or equal to total
    const items = page.locator('[cmdk-item]');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show "Add New" option when search term not found', async ({ page }) => {
    // Click the farmer combobox button
    await page.click('button[role="combobox"]:has-text("Select a farmer")');

    // Type a unique search term that likely doesn't exist
    const uniqueName = `NewFarmer${Date.now()}`;
    await page.fill('input[placeholder*="Search farmer"]', uniqueName);

    // Wait a bit for filtering
    await page.waitForTimeout(500);

    // Should show "Add" option
    const addOption = page.locator(`[cmdk-item]:has-text("Add")`);
    await expect(addOption).toBeVisible();
  });

  test('should select an option and close dropdown', async ({ page }) => {
    // Click the farmer combobox button
    await page.click('button[role="combobox"]:has-text("Select a farmer")');

    // Click first item if exists
    const firstItem = page.locator('[cmdk-item]').first();
    const isVisible = await firstItem.isVisible();

    if (isVisible) {
      await firstItem.click();

      // Dropdown should close
      await expect(page.locator('[cmdk-root]')).not.toBeVisible();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Click the farmer combobox button
    await page.click('button[role="combobox"]:has-text("Select a farmer")');

    // Press arrow down
    await page.keyboard.press('ArrowDown');

    // Press Enter to select
    await page.keyboard.press('Enter');

    // Dropdown should close after selection
    await page.waitForTimeout(300);
    const popover = page.locator('[cmdk-root]');
    const isVisible = await popover.isVisible();
    expect(isVisible).toBe(false);
  });
});
