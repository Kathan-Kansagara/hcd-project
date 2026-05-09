import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Suppliers Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
  });

  test('should display suppliers page with correct layout', async ({ page }) => {
    await page.goto('/suppliers');

    // Verify page header
    await expect(page.getByRole('heading', { name: 'Suppliers', level: 1 })).toBeVisible();
    await expect(page.getByText('Manage supplier information and contacts')).toBeVisible();

    // Verify action buttons
    await expect(page.getByRole('button', { name: /export excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new supplier/i })).toBeVisible();

    // Verify table is present
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should open supplier form dialog when clicking New Supplier', async ({ page }) => {
    await page.goto('/suppliers');

    // Click New Supplier button
    await page.getByRole('button', { name: /new supplier/i }).click();

    // Verify dialog opened
    await expect(page.getByRole('dialog', { name: /add new supplier/i })).toBeVisible();
    await expect(page.getByText('Enter details for the new supplier')).toBeVisible();

    // Verify all form fields are present
    await expect(page.getByRole('textbox', { name: /company name/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /contact person/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /contact number/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /pincode/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /city/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /state/i })).toBeVisible();
  });

  test('should validate required fields on form submission', async ({ page }) => {
    await page.goto('/suppliers');
    await page.getByRole('button', { name: /new supplier/i }).click();

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /add supplier/i }).click();

    // Form should still be visible (validation failed)
    await expect(page.getByRole('dialog', { name: /add new supplier/i })).toBeVisible();
  });

  test('should create a new supplier successfully', async ({ page }) => {
    await page.goto('/suppliers');

    // Get initial supplier count
    const initialCountText = await page.getByText(/\d+ total suppliers/).textContent();
    const initialCount = parseInt(initialCountText?.match(/\d+/)?.[0] || '0');

    // Click New Supplier
    await page.getByRole('button', { name: /new supplier/i }).click();

    // Fill in the form
    const timestamp = Date.now();
    await page.getByRole('textbox', { name: /company name/i }).fill(`Test Supplier ${timestamp}`);
    await page.getByRole('textbox', { name: /contact person/i }).fill('Test Contact');
    await page.getByRole('textbox', { name: /contact number/i }).fill('9876543210');
    await page.getByRole('textbox', { name: /email/i }).fill(`test${timestamp}@supplier.com`);
    await page.getByRole('textbox', { name: /address line 1/i }).fill('Test Address');
    await page.getByRole('textbox', { name: /pincode/i }).fill('380001');

    // Wait for pincode auto-fill (should populate city and state)
    await page.waitForTimeout(1000);

    // Fill payment terms
    await page.getByRole('textbox', { name: /payment terms/i }).fill('Net 30');

    // Submit the form
    await page.getByRole('button', { name: /add supplier/i }).click();

    // Wait for dialog to close
    await expect(page.getByRole('dialog', { name: /add new supplier/i })).not.toBeVisible();

    // Verify success message (toast)
    await expect(page.getByText(/supplier (created|added) successfully/i)).toBeVisible();

    // Verify supplier count increased
    await expect(page.getByText(new RegExp(`${initialCount + 1} total suppliers`))).toBeVisible();

    // Verify new supplier appears in table
    await expect(page.getByRole('cell', { name: `Test Supplier ${timestamp}` })).toBeVisible();
  });

  test('should export suppliers to Excel', async ({ page }) => {
    await page.goto('/suppliers');

    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Click Export Excel button
    await page.getByRole('button', { name: /export excel/i }).click();

    // Wait for download
    const download = await downloadPromise;

    // Verify filename contains 'suppliers'
    expect(download.suggestedFilename()).toMatch(/suppliers/i);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});

test.describe('Suppliers Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.goto('/suppliers');

    // Verify page header is visible
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible();

    // Verify action buttons are visible (may stack vertically)
    await expect(page.getByRole('button', { name: /export excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new supplier/i })).toBeVisible();

    // Verify table is scrollable or displays properly on mobile
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should open and use form dialog on mobile', async ({ page }) => {
    await page.goto('/suppliers');

    // Open form
    await page.getByRole('button', { name: /new supplier/i }).click();

    // Verify dialog is visible and usable on mobile
    await expect(page.getByRole('dialog', { name: /add new supplier/i })).toBeVisible();

    // Verify pincode field uses numeric keyboard (inputMode="numeric")
    const pincodeField = page.getByRole('textbox', { name: /pincode/i });
    await expect(pincodeField).toHaveAttribute('inputMode', 'numeric');
  });
});
