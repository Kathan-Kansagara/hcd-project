import { test, expect } from '@playwright/test';

test.describe('Purchase Orders Page - Task Group 5.4', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/purchase-orders');
    await page.waitForLoadState('networkidle');
  });

  test('should display purchase orders page with correct header and buttons', async ({ page }) => {
    // Verify page header
    await expect(page.getByRole('heading', { name: 'Purchase Orders', level: 1 })).toBeVisible();
    await expect(page.getByText('Manage raw material purchase orders')).toBeVisible();

    // Verify action buttons
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Purchase Order/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Show Filters/i })).toBeVisible();

    // Verify table with correct columns
    await expect(page.getByText('All Purchase Orders')).toBeVisible();
    await expect(page.locator('th', { hasText: 'PO Number' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Supplier' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Order Date' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Expected Delivery' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Status' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Total Amount' })).toBeVisible();
  });

  test('should open create PO dialog with all form fields', async ({ page }) => {
    await page.getByRole('button', { name: /Add Purchase Order/i }).click();

    // Verify dialog opened
    await expect(page.getByRole('heading', { name: 'Create Purchase Order' })).toBeVisible();
    await expect(page.getByText('Create a new purchase order for raw materials')).toBeVisible();

    // Verify supplier field with searchable dropdown
    await expect(page.getByText('Supplier *').first()).toBeVisible();
    await expect(page.getByPlaceholder('Select or add supplier')).toBeVisible();

    // Verify date pickers
    await expect(page.getByText('Order Date *')).toBeVisible();
    await expect(page.getByText('Expected Delivery Date')).toBeVisible();

    // Verify notes field
    await expect(page.getByText('Notes')).toBeVisible();
    await expect(page.getByPlaceholder('Additional notes or instructions')).toBeVisible();

    // Verify line items section
    await expect(page.getByText('Line Items *')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible();
    await expect(page.getByText('Item 1')).toBeVisible();

    // Verify grand total
    await expect(page.getByText('Grand Total:')).toBeVisible();
    await expect(page.getByText('₹0.00')).toBeVisible();
  });

  test('should support adding multiple line items', async ({ page }) => {
    await page.getByRole('button', { name: /Add Purchase Order/i }).click();

    // Initially should have 1 item
    await expect(page.getByText('Item 1')).toBeVisible();

    // Add second item
    await page.getByRole('button', { name: 'Add Item' }).click();
    await expect(page.getByText('Item 2')).toBeVisible();

    // Add third item
    await page.getByRole('button', { name: 'Add Item' }).click();
    await expect(page.getByText('Item 3')).toBeVisible();

    // Verify all items have required fields
    const rmFields = page.getByText('Raw Material *');
    const count = await rmFields.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('should remove line items when delete button clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Add Purchase Order/i }).click();

    // Add a second item
    await page.getByRole('button', { name: 'Add Item' }).click();
    await expect(page.getByText('Item 2')).toBeVisible();

    // Find and click the delete button for Item 2
    const item2Section = page.locator('text=Item 2').locator('..');
    const deleteButton = item2Section.locator('button').first();

    // Check if delete button exists (should have trash icon)
    const buttonCount = await deleteButton.count();
    if (buttonCount > 0) {
      await deleteButton.click();

      // Item 2 should be removed
      await expect(page.getByText('Item 2')).not.toBeVisible();
    }
  });

  test('should show validation errors when required fields are empty', async ({ page }) => {
    await page.getByRole('button', { name: /Add Purchase Order/i }).click();

    // Try to submit empty form
    await page.getByRole('button', { name: 'Create Purchase Order' }).click();

    // Should show validation error for supplier
    await expect(page.getByText(/Please select or create a supplier/i)).toBeVisible();
  });

  test('should toggle filters section', async ({ page }) => {
    const filtersButton = page.getByRole('button', { name: /Show Filters/i });

    // Click to show filters
    await filtersButton.click();
    await expect(page.getByText(/Filters coming soon/i)).toBeVisible();

    // Click again to hide filters
    await filtersButton.click();
    await expect(page.getByText(/Filters coming soon/i)).not.toBeVisible();
  });

  test('should close dialog when cancel button is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Add Purchase Order/i }).click();
    await expect(page.getByRole('heading', { name: 'Create Purchase Order' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Create Purchase Order' })).not.toBeVisible();
  });

  test('should close dialog when X button is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Add Purchase Order/i }).click();
    await expect(page.getByRole('heading', { name: 'Create Purchase Order' })).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { name: 'Create Purchase Order' })).not.toBeVisible();
  });

  test('should be responsive at 375px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should still load and be functional
    await expect(page.getByRole('heading', { name: 'Purchase Orders' })).toBeVisible();

    // Buttons should be visible (might be stacked)
    await expect(page.getByRole('button', { name: /Add Purchase Order/i })).toBeVisible();

    // Table should be visible (with horizontal scroll)
    await expect(page.getByText('All Purchase Orders')).toBeVisible();

    // Dialog should open and be usable on mobile
    await page.getByRole('button', { name: /Add Purchase Order/i }).click();
    await expect(page.getByRole('heading', { name: 'Create Purchase Order' })).toBeVisible();

    // Form fields should stack vertically on mobile
    await expect(page.getByText('Supplier *').first()).toBeVisible();
    await expect(page.getByText('Order Date *')).toBeVisible();
  });

  test('should display line total and grand total calculations', async ({ page }) => {
    await page.getByRole('button', { name: /Add Purchase Order/i }).click();

    // Line total should be visible for first item
    await expect(page.getByText('Line Total:')).toBeVisible();

    // Grand total should be at bottom
    await expect(page.getByText('Grand Total:')).toBeVisible();

    // Initially both should show ₹0.00
    const lineTotalText = await page.locator('text=Line Total:').locator('..').textContent();
    expect(lineTotalText).toContain('₹0.00');

    const grandTotalText = await page.locator('text=Grand Total:').locator('..').textContent();
    expect(grandTotalText).toContain('₹0.00');
  });

  test('should have unit dropdown for each line item', async ({ page }) => {
    await page.getByRole('button', { name: /Add Purchase Order/i }).click();

    // Verify unit dropdown exists
    await expect(page.getByText('Unit').first()).toBeVisible();

    // Unit dropdown should have default value
    const unitSelect = page.locator('select').first();
    const selectedValue = await unitSelect.inputValue();
    expect(selectedValue).toBe('LITER');
  });
});

test.describe('Purchase Orders Page - Excel Export', () => {
  test('should have Excel export button', async ({ page }) => {
    await page.goto('http://localhost:5173/purchase-orders');
    await page.waitForLoadState('networkidle');

    const exportButton = page.getByRole('button', { name: /Export Excel/i });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
  });
});
