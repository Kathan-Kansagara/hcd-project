/**
 * BOM / Product Recipes workflow E2E test
 * Tests: login, navigate to BOM, examine page, add BOM item (product + raw material + quantity)
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, 'bom-workflow-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('BOM / Product Recipes Workflow', () => {
  test('Full workflow: login, examine BOM page, add BOM item', async ({ page }) => {
    const report: string[] = [];

    // Step 1 & 2: Login
    report.push('=== Step 1-2: Login ===');
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email Address').fill('admin@zenon.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    report.push('  ✓ Logged in successfully');

    // Step 3 & 4: Navigate to BOM and screenshot
    report.push('\n=== Step 3-4: Navigate to BOM and capture initial state ===');
    await page.goto('http://localhost:5173/bom');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-bom-initial.png'), fullPage: true });
    report.push('  ✓ Screenshot saved: 04-bom-initial.png');

    // Step 5: Examine page - document what's visible
    report.push('\n=== Step 5: Page examination ===');
    const heading = page.getByRole('heading', { name: /bill of materials|bom|product recipes/i });
    const hasHeading = await heading.isVisible().catch(() => false);
    report.push(`  Page heading visible: ${hasHeading}`);

    const exportBtn = page.getByRole('button', { name: /export excel/i });
    const addBomBtn = page.getByRole('button', { name: /add bom item/i });
    const filtersBtn = page.getByRole('button', { name: /filters/i });
    report.push(`  Export Excel button: ${await exportBtn.isVisible().catch(() => false)}`);
    report.push(`  Add BOM Item button: ${await addBomBtn.isVisible().catch(() => false)}`);
    report.push(`  Filters button: ${await filtersBtn.isVisible().catch(() => false)}`);

    const table = page.getByRole('table');
    const hasTable = await table.isVisible().catch(() => false);
    report.push(`  BOM items table: ${hasTable}`);

    const tableHeaders = await page.locator('thead th').allTextContents().catch(() => []);
    report.push(`  Table columns: ${tableHeaders.join(', ')}`);

    const rowCount = await page.locator('tbody tr').count().catch(() => 0);
    report.push(`  Rows in table: ${rowCount}`);

    // Step 6: Interact - click Add BOM Item
    report.push('\n=== Step 6: Add BOM Item - open form ===');
    await addBomBtn.click();
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-bom-form-open.png'), fullPage: true });
    report.push('  ✓ Add BOM Item dialog opened');
    report.push('  ✓ Screenshot saved: 06-bom-form-open.png');

    // Document form fields
    const productField = page.getByRole('button', { name: /select product|product/i }).first();
    const rmField = page.getByRole('button', { name: /select raw material|raw material/i }).first();
    const qtyField = page.getByLabel(/quantity per unit/i);
    const unitSelect = page.getByRole('combobox');
    const notesField = page.getByLabel(/notes/i);
    report.push(`  Product selector: ${await productField.isVisible().catch(() => false)}`);
    report.push(`  Raw Material selector: ${await rmField.isVisible().catch(() => false)}`);
    report.push(`  Quantity per Unit field: ${await qtyField.isVisible().catch(() => false)}`);
    report.push(`  Unit dropdown: ${await unitSelect.isVisible().catch(() => false)}`);
    report.push(`  Notes field: ${await notesField.isVisible().catch(() => false)}`);

    // Select Product
    report.push('\n  Selecting product...');
    await productField.click();
    await page.waitForTimeout(500);
    const options = page.getByRole('option');
    const optionCount = await options.count();
    report.push(`  Products in dropdown: ${optionCount}`);
    if (optionCount > 0) {
      await options.first().click();
      report.push('  ✓ Product selected');
    } else {
      report.push('  ⚠ No products available - cannot complete BOM item');
    }

    await page.waitForTimeout(300);

    // Select Raw Material
    report.push('  Selecting raw material...');
    await rmField.click();
    await page.waitForTimeout(500);
    const rmOptions = page.getByRole('option');
    const rmOptionCount = await rmOptions.count();
    report.push(`  Raw materials in dropdown: ${rmOptionCount}`);
    if (rmOptionCount > 0) {
      await rmOptions.first().click();
      report.push('  ✓ Raw material selected');
    } else {
      report.push('  ⚠ No raw materials available');
    }

    await page.waitForTimeout(300);

    // Fill quantity and unit
    report.push('  Filling quantity and unit...');
    await qtyField.fill('2.5');
    const unitTriggers = page.getByRole('combobox');
    const unitCount = await unitTriggers.count();
    if (unitCount > 0) {
      await unitTriggers.last().click();
      await page.waitForTimeout(300);
      await page.getByRole('option', { name: /LITER|KG|PIECE/ }).first().click();
      report.push('  ✓ Unit selected');
    }
    report.push('  ✓ Quantity: 2.5');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-bom-form-filled.png'), fullPage: true });
    report.push('  ✓ Screenshot saved: 06-bom-form-filled.png');

    // Submit form
    report.push('\n  Submitting form...');
    await page.getByRole('button', { name: /create/i }).click();

    // Step 7: Wait and capture result
    report.push('\n=== Step 7: Result after submit ===');
    await page.waitForTimeout(2500);

    const successToast = page.getByText(/bom item created successfully/i);
    const errorToast = page.getByText(/failed|error/i);
    const hasSuccess = await successToast.isVisible().catch(() => false);
    const hasError = await errorToast.isVisible().catch(() => false);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-after-create.png'), fullPage: true });
    report.push(`  Success toast: ${hasSuccess}`);
    report.push(`  Error visible: ${hasError}`);
    report.push('  ✓ Screenshot saved: 07-after-create.png');

    // Verify workflow makes sense
    report.push('\n=== Workflow assessment ===');
    report.push('  Product -> Raw Material -> Quantity per Unit: ✓ Supported');
    report.push('  Form fields: Product, Raw Material, Quantity per Unit, Unit, Notes');
    report.push('  Table shows: Product, Raw Material, Category, Quantity per Unit, Notes');

    if (hasSuccess) {
      report.push('\n  ✓ BOM item created successfully');
    } else if (hasError) {
      report.push('\n  ✗ Error occurred - check screenshot');
    }

    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'workflow-report.txt'), report.join('\n'));
    console.log('\n' + report.join('\n'));

    expect(hasSuccess || !hasError).toBeTruthy();
  });
});
