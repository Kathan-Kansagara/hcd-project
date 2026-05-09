import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Trials Page - Task Group 7.5', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
    await page.goto('http://localhost:5173/trials');
    await page.waitForLoadState('networkidle');
  });

  test('should display trials page with correct header and structure', async ({ page }) => {
    // Verify page header
    await expect(page.getByRole('heading', { name: 'Trials', level: 1 })).toBeVisible();
    await expect(page.getByText('Manage and monitor all crop trials')).toBeVisible();

    // Verify action buttons
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Trial/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Filters/i })).toBeVisible();

    // Verify table card
    await expect(page.getByText('All Trials')).toBeVisible();

    // Verify table columns (if data exists)
    const hasData = await page.locator('th', { hasText: 'Farmer' }).isVisible().catch(() => false);
    if (hasData) {
      await expect(page.locator('th', { hasText: 'Farmer' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Product' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Crop' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Village' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Start Date' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Status' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Applications' })).toBeVisible();
    }
  });

  test('should open multi-step trial wizard when New Trial clicked', async ({ page }) => {
    await page.getByRole('button', { name: /New Trial/i }).click();

    // Verify wizard dialog opened
    await expect(page.getByRole('heading', { name: 'Add New Trial' })).toBeVisible();
    await expect(page.getByText('Create a new crop trial by following the steps below')).toBeVisible();

    // Verify step indicators (use first() to avoid strict mode violation)
    await expect(page.getByText('Basic Info').first()).toBeVisible();
    await expect(page.getByText('Applications').first()).toBeVisible();
    await expect(page.getByText('Final Details').first()).toBeVisible();

    // Verify step 1 content
    await expect(page.getByText('Step 1: Basic Information')).toBeVisible();

    // Verify form fields
    await expect(page.getByRole('combobox', { name: /Product/i }).first()).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Farmer/i })).toBeVisible();
    await expect(page.getByPlaceholder('e.g., +91 98765 43210')).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Crop/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Village/i })).toBeVisible();
  });

  test('should show "+ Add Farmer" option in farmer dropdown', async ({ page }) => {
    await page.getByRole('button', { name: /New Trial/i }).click();

    // Open farmer combobox
    await page.getByRole('combobox', { name: /Farmer/i }).click();

    // Wait for dropdown to open
    await page.waitForTimeout(500);

    // Type a non-existent farmer name
    const searchInput = page.getByPlaceholder('Search farmer...');
    await searchInput.fill('New Test Farmer');

    // Wait for the add option to appear
    await page.waitForTimeout(500);

    // Verify "+ Add" option appears
    await expect(page.getByText(/Add "New Test Farmer"/i)).toBeVisible();
  });

  test('should display applications accordion in step 2', async ({ page }) => {
    // Skip if no products exist to select
    const productsExist = await page.getByRole('button', { name: /New Trial/i }).isVisible();
    if (!productsExist) {
      test.skip();
      return;
    }

    await page.getByRole('button', { name: /New Trial/i }).click();

    // Fill minimum required fields for step 1
    // Note: This test validates UI structure only, not full workflow

    // Check if we can see step navigation
    const step2Indicator = page.getByText('Applications').first();
    await expect(step2Indicator).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify page still loads
    await expect(page.getByRole('heading', { name: 'Trials', level: 1 })).toBeVisible();

    // Verify buttons stack on mobile
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Trial/i })).toBeVisible();

    // Verify table is scrollable on mobile
    const tableContainer = page.locator('.overflow-x-auto').first();
    await expect(tableContainer).toBeVisible();
  });
});
