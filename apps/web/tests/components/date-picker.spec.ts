import { test, expect } from '@playwright/test';

test.describe('DatePickerField Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Trials page which uses date pickers
    await page.goto('http://localhost:3000/trials');

    // Open add trial modal
    await page.click('button:has-text("New Trial")');
    await page.waitForSelector('[role="dialog"]');
  });

  test('should open calendar popover on button click', async ({ page }) => {
    // Find and click the start date button
    const dateButton = page.locator('button:has-text("Pick a date")').first();
    await dateButton.click();

    // Calendar should be visible
    await expect(page.locator('[role="grid"]')).toBeVisible();
  });

  test('should select a date and update button text', async ({ page }) => {
    // Click the start date button
    const dateButton = page.locator('button:has-text("Pick a date")').first();
    await dateButton.click();

    // Wait for calendar to appear
    await page.waitForSelector('[role="grid"]');

    // Click a date (try to click today or any available date)
    const dateCell = page.locator('[role="gridcell"]:not([disabled])').first();
    await dateCell.click();

    // Calendar should close
    await expect(page.locator('[role="grid"]')).not.toBeVisible();

    // Button text should change from "Pick a date"
    const buttonText = await dateButton.textContent();
    expect(buttonText).not.toContain('Pick a date');
  });

  test('should display formatted date after selection', async ({ page }) => {
    // Click the start date button
    const dateButton = page.locator('button:has-text("Pick a date")').first();
    await dateButton.click();

    // Wait for calendar
    await page.waitForSelector('[role="grid"]');

    // Select a date
    const dateCell = page.locator('[role="gridcell"]:not([disabled])').first();
    await dateCell.click();

    // Wait for update
    await page.waitForTimeout(300);

    // Button should show formatted date (e.g., "January 15, 2024")
    const buttonText = await dateButton.textContent();
    // Should contain month name or numbers (basic check)
    expect(buttonText?.length).toBeGreaterThan(5);
  });

  test('should close calendar on escape key', async ({ page }) => {
    // Click the start date button
    const dateButton = page.locator('button:has-text("Pick a date")').first();
    await dateButton.click();

    // Calendar should be visible
    await expect(page.locator('[role="grid"]')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Calendar should close
    await expect(page.locator('[role="grid"]')).not.toBeVisible();
  });

  test('should show clear button when date is selected', async ({ page }) => {
    // Click the start date button
    const dateButton = page.locator('button:has-text("Pick a date")').first();
    await dateButton.click();

    // Select a date
    await page.waitForSelector('[role="grid"]');
    const dateCell = page.locator('[role="gridcell"]:not([disabled])').first();
    await dateCell.click();

    // Wait for update
    await page.waitForTimeout(300);

    // Clear button (X icon) should be visible in the button
    const clearIcon = dateButton.locator('svg.lucide-x');
    await expect(clearIcon).toBeVisible();
  });
});
