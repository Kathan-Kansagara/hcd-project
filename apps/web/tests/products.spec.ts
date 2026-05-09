import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Products Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display products page with correct layout', async ({ page }) => {
    await page.goto('/products');

    // Verify page header
    await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();

    // Verify action buttons
    await expect(page.getByRole('button', { name: /export excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new product/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /filters/i })).toBeVisible();

    // Verify table is present
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should display status badges correctly', async ({ page }) => {
    await page.goto('/products');

    // Wait for products to load
    await page.waitForTimeout(1000);

    // Look for status badges in the table (they should use StatusBadge component)
    // Status could be "Active", "Inactive", "Draft", etc.
    const table = page.getByRole('table');

    // Verify at least one status badge is visible
    // The StatusBadge component renders as a <div> with specific styling
    await expect(table.locator('[class*="badge"]').first()).toBeVisible();
  });

  test('should toggle filters panel', async ({ page }) => {
    await page.goto('/products');

    // Click Filters button
    await page.getByRole('button', { name: /filters/i }).click();

    // Filters panel should become visible
    // (Implementation may vary - adjust selector as needed)
    await page.waitForTimeout(500);

    // Click again to close
    await page.getByRole('button', { name: /filters/i }).click();
    await page.waitForTimeout(500);
  });

  test('should open product form dialog', async ({ page }) => {
    await page.goto('/products');

    // Click New Product button
    await page.getByRole('button', { name: /new product/i }).click();

    // Verify dialog opened
    await expect(page.getByRole('dialog')).toBeVisible();

    // Verify form fields are present
    await expect(page.getByLabel(/name/i)).toBeVisible();
  });

  test('should create a new product', async ({ page }) => {
    await page.goto('/products');

    // Get initial count
    const initialCountText = await page.getByText(/\d+ total products/).textContent();
    const initialCount = parseInt(initialCountText?.match(/\d+/)?.[0] || '0');

    // Open form
    await page.getByRole('button', { name: /new product/i }).click();

    // Fill in the form
    const timestamp = Date.now();
    await page.getByLabel(/^name/i).fill(`Test Product ${timestamp}`);
    await page.getByLabel(/description/i).fill('Test Description');
    await page.getByLabel(/category/i).fill('Test Category');

    // Submit
    await page.getByRole('button', { name: /add|create/i }).click();

    // Verify success
    await expect(page.getByText(/product (created|added) successfully/i)).toBeVisible();

    // Verify count increased
    await expect(page.getByText(new RegExp(`${initialCount + 1} total products`))).toBeVisible();

    // Verify new product in table
    await expect(page.getByRole('cell', { name: `Test Product ${timestamp}` })).toBeVisible();
  });

  test('should delete a product with confirmation dialog', async ({ page }) => {
    await page.goto('/products');

    // Wait for table to load
    await page.waitForTimeout(1000);

    // Find first Actions dropdown
    const actionsButton = page.getByRole('button', { name: /actions/i }).first();
    await actionsButton.click();

    // Click Delete option
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // Confirm dialog should appear
    await expect(page.getByRole('dialog', { name: /confirm|delete/i })).toBeVisible();
    await expect(page.getByText(/are you sure/i)).toBeVisible();

    // Cancel the deletion (don't actually delete in test)
    await page.getByRole('button', { name: /cancel/i }).click();

    // Dialog should close
    await expect(page.getByRole('dialog', { name: /confirm|delete/i })).not.toBeVisible();
  });

  test('should export products to Excel', async ({ page }) => {
    await page.goto('/products');

    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Click Export Excel button
    await page.getByRole('button', { name: /export excel/i }).click();

    // Wait for download
    const download = await downloadPromise;

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/products/i);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});

test.describe('Products Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.goto('/products');

    // Verify page elements
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    await expect(page.getByRole('button', { name: /new product/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /filters/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});
