/**
 * E2E tests for Invoice features:
 * - View Invoice Dialog
 * - Invoice PDF Download
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Helper to login and navigate
async function loginAndNavigate(page: any, targetUrl: string) {
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  // Check if already logged in (redirected to dashboard)
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

test.describe('Invoice View Dialog', () => {
  test.describe.configure({ mode: 'serial' });

  test('should open View Invoice dialog when clicking View', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/invoices');

    // Wait for invoices to load
    await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
    await expect(page.getByText(/\d+ total invoices/)).toBeVisible();

    // Click action menu on first invoice
    const firstRowActionButton = page.locator('table tbody tr').first().getByRole('button');
    await firstRowActionButton.click();

    // Click "View"
    await page.getByRole('menuitem', { name: 'View' }).click();

    // Verify dialog opens with invoice details
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Check dialog title contains invoice number
    await expect(dialog.getByRole('heading', { level: 2 })).toContainText('Invoice');

    // Check key sections are present (use headings to avoid matching dialog description)
    await expect(dialog.getByRole('heading', { name: 'Invoice Details' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Customer Details' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Line Items' })).toBeVisible();

    // Check invoice detail fields
    await expect(dialog.getByText('Invoice Number')).toBeVisible();
    await expect(dialog.getByText('Invoice Date')).toBeVisible();
    await expect(dialog.getByText('Due Date')).toBeVisible();
    await expect(dialog.getByText('Place of Supply')).toBeVisible();

    // Check totals section
    await expect(dialog.getByText('Sub Total')).toBeVisible();
    await expect(dialog.getByText('Grand Total')).toBeVisible();
    await expect(dialog.getByText('Amount Due')).toBeVisible();

    // Check Download PDF button is present in dialog
    await expect(dialog.getByRole('button', { name: 'Download PDF' })).toBeVisible();
  });

  test('should display line items and totals in View dialog', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/invoices');

    await expect(page.getByText(/\d+ total invoices/)).toBeVisible();

    // Open View dialog
    const firstRowActionButton = page.locator('table tbody tr').first().getByRole('button');
    await firstRowActionButton.click();
    await page.getByRole('menuitem', { name: 'View' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Wait for data to load - Grand Total only appears after the invoice data loads
    await expect(dialog.getByText('Grand Total')).toBeVisible({ timeout: 10000 });

    // Verify line items heading is present
    await expect(dialog.getByRole('heading', { name: 'Line Items' })).toBeVisible();

    // Verify totals are displayed
    await expect(dialog.getByText('Sub Total')).toBeVisible();
    await expect(dialog.getByText('Amount Due')).toBeVisible();
    await expect(dialog.getByText('Amount Paid')).toBeVisible();
  });

  test('should close View dialog when clicking close button', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/invoices');

    await expect(page.getByText(/\d+ total invoices/)).toBeVisible();

    // Open View dialog
    const firstRowActionButton = page.locator('table tbody tr').first().getByRole('button');
    await firstRowActionButton.click();
    await page.getByRole('menuitem', { name: 'View' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Close the dialog
    await dialog.getByRole('button', { name: 'Close' }).click();

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible();
  });

  test('should download PDF from View dialog', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/invoices');

    await expect(page.getByText(/\d+ total invoices/)).toBeVisible();

    // Open View dialog
    const firstRowActionButton = page.locator('table tbody tr').first().getByRole('button');
    await firstRowActionButton.click();
    await page.getByRole('menuitem', { name: 'View' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Click Download PDF inside dialog
    await dialog.getByRole('button', { name: 'Download PDF' }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });
});

test.describe('Invoice PDF Download', () => {
  test.describe.configure({ mode: 'serial' });

  test('should display Download PDF option in invoice action menu', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/invoices');

    // Wait for invoices table to load
    await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
    await expect(page.getByText(/\d+ total invoices/)).toBeVisible();

    // Verify there are invoices in the table
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Click the action menu (three dots) on the first invoice row
    const firstRowActionButton = rows.first().getByRole('button');
    await firstRowActionButton.click();

    // Verify the dropdown menu contains "Download PDF"
    const downloadMenuItem = page.getByRole('menuitem', { name: 'Download PDF' });
    await expect(downloadMenuItem).toBeVisible();

    // Also verify "View" option exists
    const viewMenuItem = page.getByRole('menuitem', { name: 'View' });
    await expect(viewMenuItem).toBeVisible();
  });

  test('should download invoice PDF when clicking Download PDF', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/invoices');

    // Wait for invoices to load
    await expect(page.getByText(/\d+ total invoices/)).toBeVisible();
    await page.waitForTimeout(500);

    // Get the first invoice number for verification
    const firstInvoiceNumber = await page.locator('table tbody tr').first().locator('td').first().textContent();
    expect(firstInvoiceNumber).toBeTruthy();

    // Click the action menu on the first invoice
    const firstRowActionButton = page.locator('table tbody tr').first().getByRole('button');
    await firstRowActionButton.click();

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // Click "Download PDF"
    await page.getByRole('menuitem', { name: 'Download PDF' }).click();

    // Wait for the download to start
    const download = await downloadPromise;

    // Verify the download filename matches the invoice number
    const filename = download.suggestedFilename();
    expect(filename).toContain('.pdf');
    expect(filename).toContain(firstInvoiceNumber!.trim());

    // Save the file and verify it's a valid PDF (non-empty)
    const downloadPath = path.join('/tmp', filename);
    await download.saveAs(downloadPath);

    // Verify the file exists and has content
    const fileStats = fs.statSync(downloadPath);
    expect(fileStats.size).toBeGreaterThan(100); // PDF should be at least 100 bytes

    // Read first few bytes to verify PDF header (%PDF-)
    const fd = fs.openSync(downloadPath, 'r');
    const buffer = Buffer.alloc(5);
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);
    expect(buffer.toString()).toBe('%PDF-');

    // Clean up
    fs.unlinkSync(downloadPath);
  });

  test('should download PDF for different invoices', async ({ page }) => {
    await loginAndNavigate(page, 'http://localhost:5173/invoices');

    // Wait for invoices to load
    await expect(page.getByText(/\d+ total invoices/)).toBeVisible();
    await page.waitForTimeout(500);

    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    // Test download for the second invoice if available
    if (rowCount >= 2) {
      const secondInvoiceNumber = await rows.nth(1).locator('td').first().textContent();
      expect(secondInvoiceNumber).toBeTruthy();

      // Click action menu on the second row
      const secondRowActionButton = rows.nth(1).getByRole('button');
      await secondRowActionButton.click();

      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

      // Click "Download PDF"
      await page.getByRole('menuitem', { name: 'Download PDF' }).click();

      const download = await downloadPromise;
      const filename = download.suggestedFilename();
      expect(filename).toContain('.pdf');
      expect(filename).toContain(secondInvoiceNumber!.trim());

      // Save and verify
      const downloadPath = path.join('/tmp', filename);
      await download.saveAs(downloadPath);
      const fileStats = fs.statSync(downloadPath);
      expect(fileStats.size).toBeGreaterThan(100);

      // Clean up
      fs.unlinkSync(downloadPath);
    }
  });
});
