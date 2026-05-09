/**
 * E2E tests for Company Settings page
 */
import { test, expect } from '@playwright/test';

// Helper to login and navigate
async function loginAndNavigate(page: any, targetUrl: string) {
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  // Check if already logged in
  if (page.url().includes('/login')) {
    await page.getByLabel('Email Address').fill('admin@zenon.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  }

  await page.goto(targetUrl);
  await page.waitForLoadState('networkidle');
}

test.describe('Company Settings Page', () => {
  test.describe.configure({ mode: 'serial' });

  // Store original values to restore at end
  let originalCompanyName: string;

  test('should show Company Settings link in sidebar under Administration', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/dashboard');

    // Check the Administration section contains Company Settings
    const settingsLink = page.getByRole('link', { name: 'Company Settings' });
    await expect(settingsLink).toBeVisible();
    await expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  test('should load and display company settings form', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/settings');

    // Verify page heading
    await expect(page.getByRole('heading', { name: 'Company Settings', level: 1 })).toBeVisible();

    // Verify all four section cards are present
    await expect(page.getByText('Company Information', { exact: true })).toBeVisible();
    await expect(page.getByText('Address', { exact: true })).toBeVisible();
    await expect(page.getByText('Bank Details', { exact: true })).toBeVisible();
    await expect(page.getByText('Invoice Configuration', { exact: true })).toBeVisible();
    await expect(page.getByText('Invoice Terms & Conditions', { exact: true })).toBeVisible();

    // Verify key form fields are populated (not empty)
    const companyNameInput = page.getByRole('textbox', { name: 'Company Name' });
    await expect(companyNameInput).toBeVisible();
    const companyNameValue = await companyNameInput.inputValue();
    expect(companyNameValue.length).toBeGreaterThan(0);

    // Store original value for restoration later
    originalCompanyName = companyNameValue;

    // Check GSTIN field
    const gstinInput = page.getByRole('textbox', { name: 'GSTIN' });
    await expect(gstinInput).toBeVisible();
    const gstinValue = await gstinInput.inputValue();
    expect(gstinValue.length).toBe(15);

    // Check address fields
    await expect(page.getByRole('textbox', { name: 'Address Line 1' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'City' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'State' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Pincode' })).toBeVisible();

    // Check bank fields
    await expect(page.getByRole('textbox', { name: 'Bank Name' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Account Number' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'IFSC Code' })).toBeVisible();

    // Check invoice fields
    await expect(page.getByRole('textbox', { name: 'Invoice Prefix' })).toBeVisible();
  });

  test('should have Save Changes button disabled when no changes', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/settings');

    // Wait for data to load
    await expect(page.getByRole('heading', { name: 'Company Settings', level: 1 })).toBeVisible();
    const companyNameInput = page.getByRole('textbox', { name: 'Company Name' });
    await expect(companyNameInput).toBeVisible();

    // Wait for form to be populated
    await page.waitForFunction(() => {
      const input = document.querySelector('input[name="company_name"]') as HTMLInputElement;
      return input && input.value.length > 0;
    }, { timeout: 10000 });

    // Both Save buttons should be disabled (top and bottom)
    const saveButtons = page.getByRole('button', { name: 'Save Changes' });
    const count = await saveButtons.count();
    expect(count).toBe(2);

    for (let i = 0; i < count; i++) {
      await expect(saveButtons.nth(i)).toBeDisabled();
    }
  });

  test('should enable Save button when form is modified', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/settings');

    await expect(page.getByRole('heading', { name: 'Company Settings', level: 1 })).toBeVisible();

    // Wait for data to load
    await page.waitForFunction(() => {
      const input = document.querySelector('input[name="company_name"]') as HTMLInputElement;
      return input && input.value.length > 0;
    }, { timeout: 10000 });

    // Modify the company name
    const companyNameInput = page.getByRole('textbox', { name: 'Company Name' });
    await companyNameInput.clear();
    await companyNameInput.fill('Test Company Modified');

    // Save button should now be enabled
    const saveButton = page.getByRole('button', { name: 'Save Changes' }).first();
    await expect(saveButton).toBeEnabled();
  });

  test('should successfully save updated settings', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/settings');

    await expect(page.getByRole('heading', { name: 'Company Settings', level: 1 })).toBeVisible();

    // Wait for data to load
    await page.waitForFunction(() => {
      const input = document.querySelector('input[name="company_name"]') as HTMLInputElement;
      return input && input.value.length > 0;
    }, { timeout: 10000 });

    // Modify the company name
    const companyNameInput = page.getByRole('textbox', { name: 'Company Name' });
    await companyNameInput.clear();
    await companyNameInput.fill('E2E Test Company');

    // Click save
    const saveButton = page.getByRole('button', { name: 'Save Changes' }).first();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for success toast
    await expect(page.getByText('Company settings updated successfully')).toBeVisible({ timeout: 10000 });

    // Save button should be disabled again
    await expect(saveButton).toBeDisabled();
  });

  test('should persist saved settings after page reload', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/settings');

    await expect(page.getByRole('heading', { name: 'Company Settings', level: 1 })).toBeVisible();

    // Wait for data to load
    await page.waitForFunction(() => {
      const input = document.querySelector('input[name="company_name"]') as HTMLInputElement;
      return input && input.value.length > 0;
    }, { timeout: 10000 });

    // Verify the previously saved name persisted
    const companyNameInput = page.getByRole('textbox', { name: 'Company Name' });
    await expect(companyNameInput).toHaveValue('E2E Test Company');
  });

  test('should validate required fields', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/settings');

    await expect(page.getByRole('heading', { name: 'Company Settings', level: 1 })).toBeVisible();

    // Wait for data to load
    await page.waitForFunction(() => {
      const input = document.querySelector('input[name="company_name"]') as HTMLInputElement;
      return input && input.value.length > 0;
    }, { timeout: 10000 });

    // Clear the company name (required field)
    const companyNameInput = page.getByRole('textbox', { name: 'Company Name' });
    await companyNameInput.clear();

    // Try to save
    const saveButton = page.getByRole('button', { name: 'Save Changes' }).first();
    await saveButton.click();

    // Should show validation error
    await expect(page.getByText('Company name is required')).toBeVisible();
  });

  test('should restore original company name', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/settings');

    await expect(page.getByRole('heading', { name: 'Company Settings', level: 1 })).toBeVisible();

    // Wait for data to load
    await page.waitForFunction(() => {
      const input = document.querySelector('input[name="company_name"]') as HTMLInputElement;
      return input && input.value.length > 0;
    }, { timeout: 10000 });

    // Restore original name
    const companyNameInput = page.getByRole('textbox', { name: 'Company Name' });
    await companyNameInput.clear();
    await companyNameInput.fill(originalCompanyName || 'Zenon Bio Science Pvt Ltd');

    // Save
    const saveButton = page.getByRole('button', { name: 'Save Changes' }).first();
    await saveButton.click();

    // Wait for success
    await expect(page.getByText('Company settings updated successfully')).toBeVisible({ timeout: 10000 });
  });
});
