import { test, expect } from '@playwright/test';

test.describe('ConfirmDialog Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Trials page
    await page.goto('http://localhost:3000/trials');
    await page.waitForLoadState('networkidle');
  });

  test('should open confirm dialog on delete action', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Click on the actions dropdown (three dots) for first row
    const firstRowActions = page.locator('table tbody tr').first().locator('button[role="button"]:has(svg.lucide-more-vertical)');
    await firstRowActions.click();

    // Click delete option
    await page.click('text=Delete');

    // Confirm dialog should appear
    await expect(page.locator('[role="dialog"]:has-text("Confirm Delete")')).toBeVisible();
  });

  test('should display correct title and message in delete dialog', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Open actions menu and click delete
    const firstRowActions = page.locator('table tbody tr').first().locator('button[role="button"]:has(svg.lucide-more-vertical)');
    await firstRowActions.click();
    await page.click('text=Delete');

    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');

    // Check title
    await expect(page.locator('h2:has-text("Confirm Delete")')).toBeVisible();

    // Check message content
    const message = page.locator('text=are you sure');
    await expect(message).toBeVisible();
  });

  test('should have Cancel and Delete buttons', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Open actions menu and click delete
    const firstRowActions = page.locator('table tbody tr').first().locator('button[role="button"]:has(svg.lucide-more-vertical)');
    await firstRowActions.click();
    await page.click('text=Delete');

    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');

    // Check for Cancel button
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

    // Check for Delete button
    await expect(page.locator('button:has-text("Delete")')).toBeVisible();
  });

  test('should close dialog on Cancel button click', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Open actions menu and click delete
    const firstRowActions = page.locator('table tbody tr').first().locator('button[role="button"]:has(svg.lucide-more-vertical)');
    await firstRowActions.click();
    await page.click('text=Delete');

    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');

    // Click Cancel
    await page.click('button:has-text("Cancel")');

    // Dialog should close
    await expect(page.locator('[role="dialog"]:has-text("Confirm Delete")')).not.toBeVisible();
  });

  test('should show loading state on Delete button during submission', async ({ page }) => {
    // Wait for table to load
    const rowCount = await page.locator('table tbody tr').count();

    if (rowCount === 0) {
      test.skip(); // Skip if no data to delete
    }

    // Open actions menu and click delete
    const firstRowActions = page.locator('table tbody tr').first().locator('button[role="button"]:has(svg.lucide-more-vertical)');
    await firstRowActions.click();
    await page.click('text=Delete');

    // Wait for dialog
    await page.waitForSelector('[role="dialog"]');

    // Click Delete button and immediately check for disabled state
    const deleteButton = page.locator('button:has-text("Delete")').last();

    // Start delete action (but we'll check button state very quickly)
    const deletePromise = deleteButton.click();

    // Wait briefly to see if button shows loading/disabled state
    await page.waitForTimeout(100);

    // The button should either be disabled or show loading text
    const isDisabled = await deleteButton.isDisabled();
    const buttonText = await deleteButton.textContent();

    // Either button is disabled OR text changed (to show loading)
    expect(isDisabled || buttonText !== 'Delete').toBeTruthy();

    // Wait for the action to complete
    await deletePromise;
  });
});
