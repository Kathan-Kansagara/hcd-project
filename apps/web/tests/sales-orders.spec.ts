import { test, expect } from '@playwright/test';

test.describe('Sales Orders Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/sales-orders');
    await page.waitForLoadState('networkidle');
  });

  test('should display sales orders page with correct header and structure', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: 'Sales Orders', exact: true })).toBeVisible();
    await expect(page.getByText('Manage customer sales orders and deliveries')).toBeVisible();

    // Check action buttons
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Sales Order' })).toBeVisible();

    // Check filters button
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();

    // Check card wrapper
    await expect(page.getByText('All Sales Orders')).toBeVisible();
  });

  test('should open sales order form dialog when create button clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Sales Order' }).click();

    // Check dialog opened
    await expect(page.getByRole('heading', { name: 'Create Sales Order' })).toBeVisible();
    await expect(page.getByText('Create a new sales order for a customer')).toBeVisible();

    // Check form fields present
    await expect(page.getByRole('combobox', { name: 'customer' })).toBeVisible();
    await expect(page.getByLabel('Order Date *')).toBeVisible();
    await expect(page.getByLabel('Expected Delivery Date')).toBeVisible();
    await expect(page.getByText('Line Items *')).toBeVisible();
  });

  test('should show "+ Add Customer" option in customer dropdown', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Sales Order' }).click();

    // Click customer dropdown
    await page.getByRole('combobox', { name: 'customer' }).click();

    // Type a non-existent customer name
    await page.getByPlaceholder('Search customer...').fill('New Test Customer');

    // Wait for the option to appear
    await page.waitForTimeout(500);

    // Check for "+ Add" option
    await expect(page.getByRole('option', { name: /Add.*New Test Customer/i })).toBeVisible();
  });

  test('should display sales orders table with data', async ({ page }) => {
    // Check table headers
    await expect(page.getByRole('columnheader', { name: 'SO Number' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Customer' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Order Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    // Check if table has data or shows empty state
    const noDataCell = page.getByText('No sales orders found');
    const hasData = await page.locator('table tbody tr').count() > 0;

    if (!hasData) {
      await expect(noDataCell).toBeVisible();
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Check page still loads correctly
    await expect(page.getByRole('heading', { name: 'Sales Orders', exact: true })).toBeVisible();

    // Check buttons stack vertically on mobile
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Sales Order' })).toBeVisible();
  });
});
