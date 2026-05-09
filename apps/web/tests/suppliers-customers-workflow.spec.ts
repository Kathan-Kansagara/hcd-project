/**
 * Suppliers and Customers workflow E2E test
 * Tests: login, create supplier, create customer
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, 'suppliers-customers-workflow-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const report: string[] = [];

test.describe('Suppliers and Customers Workflow', () => {
  test('Part A: Suppliers workflow', async ({ page }) => {
    report.length = 0;
    report.push('=== PART A: SUPPLIERS ===');

    // Steps 1-2: Login
    report.push('Step 1-2: Login');
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email Address').fill('admin@zenon.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    report.push('  ✓ Logged in successfully');

    // Step 3: Navigate to suppliers
    report.push('Step 3: Navigate to Suppliers');
    await page.goto('http://localhost:5173/suppliers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    report.push('  ✓ Navigated to /suppliers');

    // Step 4: Screenshot
    report.push('Step 4: Screenshot of Suppliers page');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-suppliers-initial.png'), fullPage: true });
    report.push('  ✓ Screenshot saved: 04-suppliers-initial.png');

    // Step 5-6: Click New Supplier, fill form
    report.push('Step 5-6: Open form and fill supplier data');
    await page.getByRole('button', { name: /new supplier/i }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel(/company name \*/i).fill('PackageTech Solutions');
    await page.getByLabel(/contact person/i).fill('Amit Sharma');
    await page.getByLabel(/contact number/i).fill('9123456789');
    await page.getByLabel(/^email$/i).fill('amit@packagetech.com');
    await page.getByLabel(/address line 1/i).fill('45 Industrial Area');
    await page.getByLabel(/gstin/i).fill('27AADCP1234F1ZN');
    await page.getByLabel(/payment terms/i).fill('Net 30');
    report.push('  ✓ Filled all supplier fields');

    // Step 7: Submit
    report.push('Step 7: Submit supplier form');
    await page.getByRole('button', { name: /add supplier/i }).click();

    // Step 8: Wait and screenshot
    report.push('Step 8: Wait for result and screenshot');
    await page.waitForTimeout(2500);

    const supplierSuccess = await page.getByText(/supplier created successfully/i).isVisible().catch(() => false);
    const supplierError = await page.getByText(/failed to create supplier/i).isVisible().catch(() => false);
    const supplierInTable = await page.getByRole('cell', { name: 'PackageTech Solutions' }).isVisible().catch(() => false);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-supplier-after-create.png'), fullPage: true });
    report.push(`  Success toast: ${supplierSuccess}`);
    report.push(`  Error: ${supplierError}`);
    report.push(`  In table: ${supplierInTable}`);

    expect(supplierSuccess || supplierInTable).toBeTruthy();
    report.push('Step 9: ✓ Supplier created successfully');
  });

  test('Part B: Customers workflow', async ({ page }) => {
    report.length = 0;
    report.push('=== PART B: CUSTOMERS ===');

    // Steps 1-2: Login
    report.push('Step 1-2: Login');
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email Address').fill('admin@zenon.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    report.push('  ✓ Logged in successfully');

    // Step 10: Navigate to customers
    report.push('Step 10: Navigate to Customers');
    await page.goto('http://localhost:5173/customers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    report.push('  ✓ Navigated to /customers');

    // Step 11: Screenshot
    report.push('Step 11: Screenshot of Customers page');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-customers-initial.png'), fullPage: true });
    report.push('  ✓ Screenshot saved: 11-customers-initial.png');

    // Step 12-13: Click New Customer, fill form
    report.push('Step 12-13: Open form and fill customer data');
    await page.getByRole('button', { name: /new customer/i }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel(/company name \*/i).fill('Green Farms Ltd');
    await page.getByLabel(/client name/i).fill('Suresh Patel');
    await page.getByLabel(/^contact \*/i).fill('9876543211');
    await page.getByLabel(/^email \*/i).fill('suresh@greenfarms.com');
    await page.getByLabel(/address line 1 \*/i).fill('10 Farm Road');
    await page.getByLabel(/gstin/i).fill('24AADCG5678H1ZP');
    await page.getByLabel(/place of supply \*/i).fill('24-Gujarat');
    await page.getByLabel(/payment terms \*/i).fill('Net 15');

    // Customer form requires pincode (6 digits), city, state - LocationSelector has defaults
    // Pincode is required - use valid Gujarat pincode
    const pincodeInput = page.getByLabel(/pincode \*/i);
    if (await pincodeInput.isVisible().catch(() => false)) {
      await pincodeInput.fill('360311');
    }
    report.push('  ✓ Filled all customer fields (including pincode 360311 for required validation)');

    // Step 14: Submit
    report.push('Step 14: Submit customer form');
    await page.getByRole('button', { name: /create customer/i }).click();

    // Step 15: Wait and screenshot
    report.push('Step 15: Wait for result and screenshot');
    await page.waitForTimeout(2500);

    const customerSuccess = await page.getByText(/customer created successfully/i).isVisible().catch(() => false);
    const customerError = await page.getByText(/failed to create customer/i).isVisible().catch(() => false);
    const customerInTable = await page.getByRole('cell', { name: 'Green Farms Ltd' }).isVisible().catch(() => false);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15-customer-after-create.png'), fullPage: true });
    report.push(`  Success toast: ${customerSuccess}`);
    report.push(`  Error: ${customerError}`);
    report.push(`  In table: ${customerInTable}`);

    expect(customerSuccess || customerInTable).toBeTruthy();
    report.push('Step 16: ✓ Customer created successfully');
  });
});

test.afterAll(() => {
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'workflow-report.txt'), report.join('\n'));
  console.log('\n' + report.join('\n'));
});
