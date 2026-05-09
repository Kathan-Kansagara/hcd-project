import { test, expect } from '@playwright/test';

test.describe('Payments Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/payments');
    await page.waitForLoadState('networkidle');
  });

  test('should display payments page with correct header and structure', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
    await expect(page.getByText('Track and manage customer payments')).toBeVisible();

    // Check action buttons
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record Payment' })).toBeVisible();

    // Check filters button
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();

    // Check card wrapper
    await expect(page.getByText('All Payments')).toBeVisible();
  });

  test('should display payments table with correct headers', async ({ page }) => {
    // Check table headers
    await expect(page.getByRole('columnheader', { name: 'Payment Number' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Invoice Number' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Customer' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Payment Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Payment Method' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Reference' })).toBeVisible();
  });

  test('should display payment method badges when data exists', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1000);

    // Check if there's data
    const hasData = await page.locator('table tbody tr').count() > 0;

    if (hasData) {
      // Check that payment method badges are displayed (looking for common payment methods)
      const methodBadges = page.locator('table tbody').getByText(/Cash|Cheque|Bank Transfer|UPI|Card/);
      const count = await methodBadges.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Check page still loads correctly
    await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();

    // Check buttons are visible on mobile
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record Payment' })).toBeVisible();
  });

  test('should show total payments count', async ({ page }) => {
    // Check that total count is displayed
    await expect(page.getByText(/\d+ total payments/)).toBeVisible();
  });
});
