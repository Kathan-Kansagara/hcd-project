import { test, expect } from '@playwright/test';

test.describe('Invoices Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/invoices');
    await page.waitForLoadState('networkidle');
  });

  test('should display invoices page with correct header and structure', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
    await expect(page.getByText('Manage customer invoices and billing')).toBeVisible();

    // Check action buttons
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeVisible();

    // Check filters button
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();

    // Check card wrapper
    await expect(page.getByText('All Invoices')).toBeVisible();
  });

  test('should display invoices table with correct headers', async ({ page }) => {
    // Check table headers
    await expect(page.getByRole('columnheader', { name: 'Invoice Number' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Customer' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Invoice Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Due Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Amount', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Amount Due' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });

  test('should display status badges for invoice status', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1000);

    // Check if there's data
    const hasData = await page.locator('table tbody tr').count() > 0;

    if (hasData) {
      // Check that status badges are displayed (looking for common invoice statuses)
      const statusBadges = page.locator('table tbody').getByText(/SENT|PAID|DRAFT|OVERDUE|PARTIALLY_PAID/);
      const count = await statusBadges.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Check page still loads correctly
    await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();

    // Check buttons are visible on mobile
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeVisible();
  });

  test('should show total invoices count', async ({ page }) => {
    // Check that total count is displayed
    await expect(page.getByText(/\d+ total invoices/)).toBeVisible();
  });
});
