import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Raw Materials Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display raw materials page with correct layout', async ({ page }) => {
    await page.goto('/raw-materials');

    // Verify page header
    await expect(page.getByRole('heading', { name: /raw materials/i, level: 1 })).toBeVisible();

    // Verify action buttons
    await expect(page.getByRole('button', { name: /export excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new raw material/i })).toBeVisible();

    // Verify table is present
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should open raw material form dialog', async ({ page }) => {
    await page.goto('/raw-materials');

    // Click New Raw Material button
    await page.getByRole('button', { name: /new raw material/i }).click();

    // Verify dialog opened
    await expect(page.getByRole('dialog')).toBeVisible();

    // Verify form fields
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/category/i)).toBeVisible();
  });

  test('should show searchable supplier dropdown', async ({ page }) => {
    await page.goto('/raw-materials');
    await page.getByRole('button', { name: /new raw material/i }).click();

    // Look for supplier field (searchable combobox)
    // The SearchableCombobox renders as a button that opens a command dialog
    const supplierButton = page.getByRole('button', { name: /select supplier|supplier/i }).first();
    await expect(supplierButton).toBeVisible();

    // Click to open dropdown
    await supplierButton.click();

    // Verify search input appears
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('should show "+ Add Supplier" option when searching', async ({ page }) => {
    await page.goto('/raw-materials');
    await page.getByRole('button', { name: /new raw material/i }).click();

    // Open supplier dropdown
    const supplierButton = page.getByRole('button', { name: /select supplier|supplier/i }).first();
    await supplierButton.click();

    // Type a search term that won't match any existing supplier
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('NewSupplierTest123');

    // Verify "+ Add Supplier" option appears
    await expect(page.getByText(/\+ add/i)).toBeVisible();
  });

  test('should create raw material with existing supplier', async ({ page }) => {
    await page.goto('/raw-materials');

    // Click New Raw Material
    await page.getByRole('button', { name: /new raw material/i }).click();

    // Fill in basic info
    const timestamp = Date.now();
    await page.getByLabel(/^name/i).fill(`Test Raw Material ${timestamp}`);
    await page.getByLabel(/category/i).fill('Test Category');
    await page.getByLabel(/unit/i).fill('kg');

    // Select supplier (first available)
    const supplierButton = page.getByRole('button', { name: /select supplier|supplier/i }).first();
    await supplierButton.click();

    // Wait for dropdown to load suppliers
    await page.waitForTimeout(500);

    // Select first supplier from list
    await page.getByRole('option').first().click();

    // Submit form
    await page.getByRole('button', { name: /add|create/i }).click();

    // Verify success
    await expect(page.getByText(/raw material (created|added) successfully/i)).toBeVisible();

    // Verify new raw material appears in table
    await expect(page.getByRole('cell', { name: `Test Raw Material ${timestamp}` })).toBeVisible();
  });

  test('should export raw materials to Excel', async ({ page }) => {
    await page.goto('/raw-materials');

    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Click Export Excel button
    await page.getByRole('button', { name: /export excel/i }).click();

    // Wait for download
    const download = await downloadPromise;

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/raw.?materials/i);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});

test.describe('Raw Materials Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.goto('/raw-materials');

    // Verify page elements are visible
    await expect(page.getByRole('heading', { name: /raw materials/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new raw material/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should open form dialog on mobile', async ({ page }) => {
    await page.goto('/raw-materials');

    await page.getByRole('button', { name: /new raw material/i }).click();

    // Dialog should be usable on mobile
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
  });
});
