/**
 * Raw Materials workflow E2E test
 * Tests: login, navigate to raw materials, create new raw material with test data
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { login } from './helpers/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, 'raw-materials-workflow-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Raw Materials Workflow', () => {
  test('Full workflow: login, navigate, create HDPE Bottle 1L', async ({ page }) => {
    const report: string[] = [];

    // Step 1 & 2: Navigate and login
    report.push('Step 1-2: Login');
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email Address').fill('admin@zenon.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    report.push('  ✓ Logged in successfully');

    // Step 3: Navigate to raw materials
    report.push('Step 3: Navigate to Raw Materials');
    await page.goto('http://localhost:5173/raw-materials');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    report.push('  ✓ Navigated to /raw-materials');

    // Step 4: Screenshot of raw materials page
    report.push('Step 4: Screenshot of Raw Materials page');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-raw-materials-initial.png'), fullPage: true });
    report.push('  ✓ Screenshot saved: 04-raw-materials-initial.png');

    // Step 5 & 6: Find and click New Raw Material, fill form
    report.push('Step 5-6: Open form and fill test data');
    const newButton = page.getByRole('button', { name: /new raw material/i });
    await expect(newButton).toBeVisible();
    await newButton.click();
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill Name
    await page.getByLabel(/^name \*/i).fill('HDPE Bottle 1L');

    // Select Category: PACKAGING_PRIMARY (first combobox in form)
    await page.getByRole('combobox').first().click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /PACKAGING PRIMARY/i }).click();

    // Select Unit: PIECE (second combobox in form)
    await page.waitForTimeout(200);
    await page.getByRole('combobox').nth(1).click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: 'PIECE' }).click();

    // Fill Min Stock Level
    await page.getByLabel(/min stock level/i).fill('100');

    // Fill Reorder Point (labeled "Reorder Quantity" in form)
    await page.getByLabel(/reorder|reorder quantity/i).fill('50');

    report.push('  ✓ Filled: Name, Category (PACKAGING_PRIMARY), Unit (PIECE), Min Stock Level (100), Reorder Point (50)');
    report.push('  ⚠ Note: GST Rate, HSN/SAC Code, Default Unit Price - fields not present in current form');

    // Step 7: Submit form
    report.push('Step 7: Submit form');
    await page.getByRole('button', { name: /create/i }).click();

    // Step 8: Wait and screenshot
    report.push('Step 8: Wait for result and screenshot');
    await page.waitForTimeout(2500);

    const successToast = page.getByText(/raw material created successfully/i);
    const errorToast = page.getByText(/failed|error/i);
    const hasSuccess = await successToast.isVisible().catch(() => false);
    const hasError = await errorToast.isVisible().catch(() => false);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-after-create.png'), fullPage: true });
    report.push(`  ✓ Screenshot saved: 08-after-create.png`);
    report.push(`  Success toast visible: ${hasSuccess}`);
    report.push(`  Error visible: ${hasError}`);

    // Check if HDPE Bottle 1L appears in table
    const inTable = await page.getByRole('cell', { name: 'HDPE Bottle 1L' }).isVisible().catch(() => false);
    report.push(`  Raw material in table: ${inTable}`);

    // Step 9: Assert and write report
    expect(hasSuccess || inTable).toBeTruthy();
    report.push('Step 9: ✓ Test completed - Raw material created successfully');

    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'workflow-report.txt'), report.join('\n'));
    console.log('\n' + report.join('\n'));
  });
});
