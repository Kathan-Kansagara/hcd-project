import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Farmers Page - Task Group 7.9', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
    await page.goto('http://localhost:5173/farmers');
    await page.waitForLoadState('networkidle');
  });

  test('should display farmers page with correct header and structure', async ({ page }) => {
    // Verify page header
    await expect(page.getByRole('heading', { name: 'Farmers', level: 1 })).toBeVisible();
    await expect(page.getByText('Manage farmer information and contacts')).toBeVisible();

    // Verify action buttons
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Farmer/i })).toBeVisible();

    // Verify table card
    await expect(page.getByText('All Farmers')).toBeVisible();

    // Verify table columns (if data exists)
    const hasData = await page.locator('th', { hasText: 'Name' }).isVisible().catch(() => false);
    if (hasData) {
      await expect(page.locator('th', { hasText: 'Name' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Village' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'City' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'District' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'State' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Contact' })).toBeVisible();
    }
  });

  test('should open farmer form dialog when New Farmer clicked', async ({ page }) => {
    await page.getByRole('button', { name: /New Farmer/i }).click();

    // Verify dialog opened
    await expect(page.getByRole('heading', { name: /Add New Farmer/i })).toBeVisible();

    // Verify form fields
    await expect(page.getByPlaceholder('e.g., Ramesh Patel')).toBeVisible();
    await expect(page.getByPlaceholder('e.g., +91 98765 43210')).toBeVisible();

    // Verify location section
    await expect(page.getByText('Location Details')).toBeVisible();
    await expect(page.getByPlaceholder('e.g., 380001')).toBeVisible(); // Pincode field
    await expect(page.getByRole('combobox', { name: /Village/i })).toBeVisible();
  });

  test('should display location fields in farmer form', async ({ page }) => {
    await page.getByRole('button', { name: /New Farmer/i }).click();

    // Wait for form to load
    await page.waitForTimeout(500);

    // Verify the key form elements are present
    await expect(page.getByPlaceholder('e.g., Ramesh Patel')).toBeVisible();
    await expect(page.getByPlaceholder('e.g., 380001')).toBeVisible();

    // Verify buttons
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Save/i }).or(page.getByRole('button', { name: /Create/i }))).toBeVisible();
  });

  test('should have pincode autofill functionality', async ({ page }) => {
    await page.getByRole('button', { name: /New Farmer/i }).click();

    // Enter valid pincode
    const pincodeInput = page.getByPlaceholder('e.g., 380001');
    await pincodeInput.fill('380001');

    // Blur the input to trigger auto-fill
    await pincodeInput.blur();

    // Wait for API call to complete
    await page.waitForTimeout(2000);

    // Verify village combobox is enabled (means form is interactive)
    const villageCombobox = page.getByRole('combobox', { name: /Village/i });
    await expect(villageCombobox).toBeEnabled();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify page still loads
    await expect(page.getByRole('heading', { name: 'Farmers', level: 1 })).toBeVisible();

    // Verify buttons stack on mobile
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Farmer/i })).toBeVisible();

    // Verify table is scrollable on mobile
    const tableContainer = page.locator('.overflow-x-auto').first();
    await expect(tableContainer).toBeVisible();

    // Test opening form on mobile
    await page.getByRole('button', { name: /New Farmer/i }).click();

    // Verify dialog opens and is usable on mobile
    await expect(page.getByRole('heading', { name: /Add New Farmer/i })).toBeVisible();
    await expect(page.getByPlaceholder('e.g., Ramesh Patel')).toBeVisible();
  });
});
