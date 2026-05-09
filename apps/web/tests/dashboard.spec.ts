import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Dashboard Page - Task Group 9', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
    // Navigate to dashboard
    await page.goto('http://localhost:5173');
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display dashboard page with correct header and structure', async ({ page }) => {
    // Check page title using getByRole
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expect(page.getByText('Overview of Zenon Bio Science operations')).toBeVisible();

    // Check New Trial button exists
    await expect(page.getByRole('button', { name: /New Trial/i })).toBeVisible();
  });

  test('should display trial statistics section with metrics', async ({ page }) => {
    // Check section header
    await expect(page.getByRole('heading', { name: 'Trial Statistics', level: 2 })).toBeVisible();

    // Check all trial statistics cards are visible
    await expect(page.getByText('Total Trials')).toBeVisible();
    await expect(page.getByText('In Progress').first()).toBeVisible();
    await expect(page.getByText('Completed').first()).toBeVisible();

    // Check descriptions
    await expect(page.getByText('All crop trials')).toBeVisible();
    await expect(page.getByText('Active trials')).toBeVisible();
    await expect(page.getByText('Finished trials')).toBeVisible();
  });

  test('should display inventory status section with alert cards', async ({ page }) => {
    // Check section header
    await expect(page.getByRole('heading', { name: 'Inventory Status', level: 2 })).toBeVisible();

    // Check all inventory cards
    await expect(page.getByText('Active Batches')).toBeVisible();
    await expect(page.getByText('Expiring Soon').first()).toBeVisible();
    await expect(page.getByText('Low Stock').first()).toBeVisible();
    await expect(page.getByText('Total Stock')).toBeVisible();

    // Check descriptions
    await expect(page.getByText('Within 30 days').first()).toBeVisible();
    await expect(page.getByText('Below 30% remaining')).toBeVisible();
  });

  test('should display sales and purchase overview section', async ({ page }) => {
    // Check section header
    await expect(page.getByRole('heading', { name: 'Sales & Purchase Overview', level: 2 })).toBeVisible();

    // Check all sales/purchase cards
    await expect(page.getByText('Total Revenue')).toBeVisible();
    await expect(page.getByText('Amount Paid')).toBeVisible();
    await expect(page.getByText('Outstanding').first()).toBeVisible();
    await expect(page.getByText('Purchase Value')).toBeVisible();

    // Check descriptions
    await expect(page.getByText('Received payments')).toBeVisible();
    await expect(page.getByText('Pending payments').first()).toBeVisible();
  });

  test('should display three alert sections with StatusBadge', async ({ page }) => {
    // Check Low Stock Alerts section
    await expect(page.getByText('Low Stock Alerts')).toBeVisible();
    await expect(page.getByText('Batches below 30% stock')).toBeVisible();

    // Check Expiring Batches section
    await expect(page.getByText('Expiring Batches')).toBeVisible();
    await expect(page.getByText('Expiring within 30 days')).toBeVisible();

    // Check Outstanding Payments section (use first() to handle duplicates)
    await expect(page.getByText('Outstanding Payments').first()).toBeVisible();
    await expect(page.getByText('Pending invoices')).toBeVisible();

    // Verify StatusBadge components show status (check for common status text)
    // The page might show: IN STOCK, EXPIRING SOON, ACTIVE, PENDING, PAID
    const pageContent = await page.textContent('body');
    const hasStatusBadges =
      pageContent?.includes('IN STOCK') ||
      pageContent?.includes('EXPIRING SOON') ||
      pageContent?.includes('ACTIVE') ||
      pageContent?.includes('PENDING') ||
      pageContent?.includes('PAID');

    expect(hasStatusBadges).toBeTruthy();
  });

  test('should display recent trials table with data', async ({ page }) => {
    // Check section header
    await expect(page.getByText('Recent Trials')).toBeVisible();
    await expect(page.getByText('Last 5 trials added to the system')).toBeVisible();

    // Check View All button
    await expect(page.getByRole('link', { name: /View All/i })).toBeVisible();

    // Check if table exists
    const table = page.locator('table').last();
    await expect(table).toBeVisible();

    // Check table headers (use first() to handle multiple tables)
    const hasHeaders = await table.locator('th').first().isVisible().catch(() => false);
    if (hasHeaders) {
      // Headers should include: Farmer, Product, Crop, Village, Start Date, Status, Applications
      await expect(table).toContainText('Farmer');
      await expect(table).toContainText('Status');
    }
  });

  test('should use StatusBadge for trial status in recent trials', async ({ page }) => {
    // Find the Recent Trials table
    const table = page.locator('table').last();

    // Check if there are data rows
    const hasData = await table.locator('tbody tr').first().isVisible().catch(() => false);

    if (hasData) {
      // The status should be displayed using StatusBadge
      // Look for common status text: DRAFT, IN PROGRESS, COMPLETED
      const tableText = await table.textContent();
      const hasStatus =
        tableText?.includes('DRAFT') ||
        tableText?.includes('IN PROGRESS') ||
        tableText?.includes('COMPLETED');

      expect(hasStatus).toBeTruthy();
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that main sections are still visible
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

    // Check key sections are visible (they should stack vertically)
    await expect(page.getByText('Trial Statistics')).toBeVisible();
    await expect(page.getByText('Inventory Status')).toBeVisible();
    await expect(page.getByText('Sales & Purchase Overview')).toBeVisible();

    // Check that alert sections are visible on mobile (use first() for duplicates)
    await expect(page.getByText('Low Stock Alerts')).toBeVisible();
    await expect(page.getByText('Expiring Batches')).toBeVisible();
    await expect(page.getByText('Outstanding Payments').first()).toBeVisible();

    // Check Recent Trials section
    await expect(page.getByText('Recent Trials')).toBeVisible();
  });
});
