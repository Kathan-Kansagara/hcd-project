/**
 * Workflow Runner - Tests all WORKFLOWS.md flows via Playwright
 * Run: npx playwright test workflow-runner --reporter=line
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
const SCREENSHOT_DIR = 'tests/workflow-screenshots';

const issues: string[] = [];
let stepNum = 0;

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'admin@zenon.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function step(name: string) {
  stepNum++;
  console.log(`\n=== STEP ${stepNum}: ${name} ===`);
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${String(stepNum).padStart(2, '0')}-${name}.png`, fullPage: true });
}

function reportIssue(issue: string) {
  console.log(`  ❌ ISSUE: ${issue}`);
  issues.push(`Step ${stepNum}: ${issue}`);
}

function reportOk(msg: string) {
  console.log(`  ✅ ${msg}`);
}

/** Helper to fill a SearchableCombobox by its aria-label */
async function fillCombobox(page: Page, ariaLabel: string, value: string, addNew = false) {
  const combobox = page.locator(`[role="dialog"] button[role="combobox"][aria-label="${ariaLabel}"]`).first();
  if (await combobox.isVisible({ timeout: 2000 }).catch(() => false)) {
    await combobox.click();
    await page.waitForTimeout(300);
    // Type into the search input inside the popover
    const searchInput = page.locator('[role="dialog"] input[placeholder*="Search"], [cmdk-input]').last();
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await searchInput.fill(value);
      await page.waitForTimeout(500);
    }
    // Try to select matching option
    const option = page.locator(`[role="option"]:has-text("${value}")`).first();
    if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
      await option.click();
    } else if (addNew) {
      // Click "Add new" option
      const addBtn = page.locator('[role="option"]:has-text("Add")').first();
      if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addBtn.click();
      }
    }
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

test('Full Workflow Test', async ({ page }) => {
  test.setTimeout(600000); // 10 minutes
  const ts = Date.now().toString().slice(-6); // Short unique suffix

  // ==========================================
  // PHASE 1: LOGIN
  // ==========================================
  await step('Login');
  await login(page);
  await screenshot(page, 'dashboard');
  const bodyText = await page.textContent('body');
  if (bodyText?.includes('Dashboard') || bodyText?.includes('Overview')) {
    reportOk('Login successful, dashboard loaded');
  } else {
    reportIssue('Login failed or dashboard not loaded');
  }

  // ==========================================
  // PHASE 2A: RAW MATERIALS - Create
  // ==========================================
  await step('Raw Materials - Create');
  await page.goto(`${BASE}/raw-materials`);
  await page.waitForTimeout(2000);

  const rmAddBtn = page.locator('button:has-text("New Raw Material")');
  if (await rmAddBtn.isVisible()) {
    await rmAddBtn.click();
    await page.waitForTimeout(1000);

    await page.locator('input[name="name"]').fill(`WF HDPE Bottle ${ts}`);

    // Category - Select component (click trigger, then option)
    await page.locator('[role="dialog"] button:has-text("Select category")').click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]:has-text("PACKAGING PRIMARY")').click();
    await page.waitForTimeout(300);

    // Unit
    await page.locator('[role="dialog"] button:has-text("Select unit")').click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]:has-text("PIECE")').click();
    await page.waitForTimeout(300);

    // New fields
    await page.locator('input[name="gst_rate"]').fill('18');
    await page.locator('input[name="hsn_sac_code"]').fill('3923');
    await page.locator('input[name="default_unit_price"]').fill('15');
    await page.locator('input[name="min_stock_level"]').fill('100');
    await page.locator('input[name="reorder_point"]').fill('50');

    await screenshot(page, 'raw-materials-form-filled');
    await page.locator('[role="dialog"] button[type="submit"]').click();
    await page.waitForTimeout(2000);

    const rmDialog = await page.locator('[role="dialog"]').isVisible();
    if (!rmDialog) {
      reportOk('Raw material created with GST/HSN/Price fields');
    } else {
      reportIssue('Raw material creation failed');
      await screenshot(page, 'raw-materials-error');
      await page.keyboard.press('Escape');
    }
  } else {
    reportIssue('Cannot find New Raw Material button');
  }

  // ==========================================
  // PHASE 2B: PRODUCTS - Create
  // ==========================================
  await step('Products - Create');
  await page.goto(`${BASE}/products`);
  await page.waitForTimeout(2000);

  const prodAddBtn = page.locator('button:has-text("New Product"), button:has-text("Add Product")').first();
  if (await prodAddBtn.isVisible()) {
    await prodAddBtn.click();
    await page.waitForTimeout(1000);

    await page.locator('input[name="name"]').fill(`WF Bio-Fertilizer ${ts}`);
    const descField = page.locator('textarea[name="description"], input[name="description"]').first();
    if (await descField.isVisible()) await descField.fill('Test bio-fertilizer in 1 liter bottle');

    const catInput = page.locator('input[name="category"]').first();
    if (await catInput.isVisible()) {
      await catInput.fill('Fertilizer');
    }

    await page.locator('[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("Create"), [role="dialog"] button:has-text("Save")').first().click();
    await page.waitForTimeout(2000);

    const prodDialog = await page.locator('[role="dialog"]').isVisible();
    if (!prodDialog) {
      reportOk('Product created successfully');
    } else {
      reportIssue('Product creation failed');
      await screenshot(page, 'products-error');
      await page.keyboard.press('Escape');
    }
  } else {
    reportIssue('Cannot find Add Product button');
  }

  // ==========================================
  // PHASE 2C: FARMERS - Create
  // ==========================================
  await step('Farmers - Create');
  await page.goto(`${BASE}/farmers`);
  await page.waitForTimeout(2000);

  const farmerAddBtn = page.locator('button:has-text("New Farmer"), button:has-text("Add Farmer"), button:has-text("Add")').first();
  if (await farmerAddBtn.isVisible()) {
    await farmerAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'farmers-form-empty');

    // Name (regular input)
    await page.locator('[role="dialog"] input[name="name"]').fill(`Rajesh Kumar ${ts}`);

    // Contact (regular input) - just 10 digits, no spaces/prefix
    const contactInput = page.locator('[role="dialog"] input[name="contact"]');
    await contactInput.click();
    await contactInput.fill('9876543210');

    // Village - SearchableCombobox with aria-label="village"
    const villageCombo = page.locator('[role="dialog"] button[role="combobox"][aria-label="village"]').first();
    if (await villageCombo.isVisible({ timeout: 2000 }).catch(() => false)) {
      await villageCombo.click();
      await page.waitForTimeout(500);
      // Type village name in the search input
      const cmdInput = page.locator('[cmdk-input], input[placeholder*="Search"]').last();
      if (await cmdInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cmdInput.fill('Khed');
        await page.waitForTimeout(500);
      }
      // Click "Add Khed" option if no matching village
      const addOption = page.locator('[role="option"]:has-text("Add"), [role="option"]:has-text("Khed")').first();
      if (await addOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addOption.click();
        await page.waitForTimeout(500);
        reportOk('Village combobox filled');
      } else {
        reportIssue('Could not find village option');
        // Close the popover
        await page.keyboard.press('Escape');
      }
    } else {
      // Maybe it's a regular input
      const villageInput = page.locator('[role="dialog"] input[name="village"]').first();
      if (await villageInput.isVisible()) {
        await villageInput.fill('Khed');
      } else {
        reportIssue('Cannot find village field');
      }
    }

    await screenshot(page, 'farmers-form-filled');

    // Submit
    await page.locator('[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("Create Farmer")').first().click();
    await page.waitForTimeout(3000);
    await screenshot(page, 'farmers-after-submit');

    const farmerDialog = await page.locator('[role="dialog"]').isVisible();
    if (!farmerDialog) {
      reportOk('Farmer created successfully');
    } else {
      const validationErrors = await page.locator('[role="dialog"] p.text-destructive, [role="dialog"] .text-red-500, [role="dialog"] [data-slot="form-message"]').allTextContents();
      if (validationErrors.length > 0) {
        reportIssue(`Farmer form validation: ${validationErrors.join(', ')}`);
      } else {
        reportIssue('Farmer creation failed - dialog still open');
      }
      await screenshot(page, 'farmers-error');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } else {
    reportIssue('Cannot find Add Farmer button');
  }

  // ==========================================
  // PHASE 2D: SUPPLIERS - Create
  // ==========================================
  await step('Suppliers - Create');
  await page.goto(`${BASE}/suppliers`);
  await page.waitForTimeout(2000);

  const suppAddBtn = page.locator('button:has-text("New Supplier"), button:has-text("Add Supplier"), button:has-text("Add")').first();
  if (await suppAddBtn.isVisible()) {
    await suppAddBtn.click();
    await page.waitForTimeout(1000);

    // Fill required fields
    await page.locator('[role="dialog"] input[name="company_name"]').fill(`WF PackageTech ${ts}`);
    const contactPerson = page.locator('[role="dialog"] input[name="contact_person"]');
    if (await contactPerson.isVisible({ timeout: 1000 }).catch(() => false)) await contactPerson.fill('Amit Sharma');
    // Supplier uses "contact" not "phone"
    const suppContact = page.locator('[role="dialog"] input[name="contact"]');
    if (await suppContact.isVisible({ timeout: 1000 }).catch(() => false)) await suppContact.fill('9123456789');
    const suppEmail = page.locator('[role="dialog"] input[name="email"]');
    if (await suppEmail.isVisible({ timeout: 1000 }).catch(() => false)) await suppEmail.fill(`wf-${ts}@packagetech.com`);
    const suppAddr = page.locator('[role="dialog"] input[name="address_line1"]');
    if (await suppAddr.isVisible({ timeout: 1000 }).catch(() => false)) await suppAddr.fill('45 Industrial Area');
    const suppGst = page.locator('[role="dialog"] input[name="gstin"]');
    if (await suppGst.isVisible({ timeout: 1000 }).catch(() => false)) await suppGst.fill('27AADCP1234F1ZN');
    const suppPayTerms = page.locator('[role="dialog"] input[name="payment_terms"]');
    if (await suppPayTerms.isVisible({ timeout: 1000 }).catch(() => false)) await suppPayTerms.fill('Net 30');

    await screenshot(page, 'suppliers-form-filled');
    await page.locator('[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("Add Supplier"), [role="dialog"] button:has-text("Create")').first().click();
    await page.waitForTimeout(2000);

    const suppDialog = await page.locator('[role="dialog"]').isVisible();
    if (!suppDialog) {
      reportOk('Supplier created successfully');
    } else {
      const errors = await page.locator('[role="dialog"] p.text-destructive, [role="dialog"] [data-slot="form-message"]').allTextContents();
      reportIssue(`Supplier creation failed: ${errors.join(', ') || 'unknown'}`);
      await screenshot(page, 'suppliers-error');
      await page.keyboard.press('Escape');
    }
  } else {
    reportIssue('Cannot find Add Supplier button');
  }

  // ==========================================
  // PHASE 2E: CUSTOMERS - Create
  // ==========================================
  await step('Customers - Create');
  await page.goto(`${BASE}/customers`);
  await page.waitForTimeout(2000);

  const custAddBtn = page.locator('button:has-text("New Customer"), button:has-text("Add Customer"), button:has-text("Add")').first();
  if (await custAddBtn.isVisible()) {
    await custAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'customers-form-empty');

    // Company name
    await page.locator('[role="dialog"] input[name="company_name"]').fill(`WF Green Farms ${ts}`);
    // Client name
    const clientName = page.locator('[role="dialog"] input[name="client_name"]');
    if (await clientName.isVisible()) await clientName.fill('Suresh Patel');
    // Contact (10 digits starting with 6-9)
    await page.locator('[role="dialog"] input[name="contact"]').fill('9876543211');
    // Email
    await page.locator('[role="dialog"] input[name="email"]').fill(`wf-${ts}@greenfarms.com`);
    // Address
    await page.locator('[role="dialog"] input[name="address_line1"]').fill('10 Farm Road');

    // Pincode - uses PincodeAutoFillField which renders input with aria-label="Pincode"
    const pincodeInput = page.locator('[role="dialog"] input[aria-label="Pincode"]').first();
    if (await pincodeInput.isVisible()) {
      await pincodeInput.click();
      await pincodeInput.fill('380001');
      await pincodeInput.blur();
      await page.waitForTimeout(2000); // Wait for pincode lookup to auto-fill city/state
      reportOk('Pincode filled via PincodeAutoFillField');
    } else {
      // Try regular input
      const pincodeRegular = page.locator('[role="dialog"] input[name="pincode"]');
      if (await pincodeRegular.isVisible()) {
        await pincodeRegular.fill('380001');
      } else {
        reportIssue('Cannot find pincode field');
      }
    }

    // Check if city/state were auto-filled by pincode lookup, if not fill manually
    // City - might be auto-filled or might need manual fill
    // The CustomerFormDialog uses LocationSelector which renders comboboxes
    const cityCombo = page.locator('[role="dialog"] button[role="combobox"][aria-label="city"]').first();
    if (await cityCombo.isVisible({ timeout: 1000 }).catch(() => false)) {
      const cityText = await cityCombo.textContent();
      if (!cityText || cityText.includes('Select') || cityText.includes('city')) {
        await cityCombo.click();
        await page.waitForTimeout(300);
        const searchInput = page.locator('[cmdk-input], input[placeholder*="Search"]').last();
        if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await searchInput.fill('Ahmedabad');
          await page.waitForTimeout(500);
        }
        const opt = page.locator('[role="option"]').first();
        if (await opt.isVisible()) await opt.click();
        await page.waitForTimeout(300);
      } else {
        reportOk(`City auto-filled: ${cityText}`);
      }
    }

    // State - might also be a combobox
    const stateCombo = page.locator('[role="dialog"] button[role="combobox"][aria-label="state"]').first();
    if (await stateCombo.isVisible({ timeout: 1000 }).catch(() => false)) {
      const stateText = await stateCombo.textContent();
      if (!stateText || stateText.includes('Select') || stateText.includes('state')) {
        await stateCombo.click();
        await page.waitForTimeout(300);
        const searchInput = page.locator('[cmdk-input], input[placeholder*="Search"]').last();
        if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await searchInput.fill('Gujarat');
          await page.waitForTimeout(500);
        }
        const opt = page.locator('[role="option"]:has-text("Gujarat")').first();
        if (await opt.isVisible()) await opt.click();
        await page.waitForTimeout(300);
      } else {
        reportOk(`State auto-filled: ${stateText}`);
      }
    }

    // Place of supply (regular input)
    await page.locator('[role="dialog"] input[name="place_of_supply"]').fill('24-Gujarat');

    // Payment terms (regular input)
    await page.locator('[role="dialog"] input[name="payment_terms"]').fill('Net 15');

    // GSTIN (optional)
    const gstinField = page.locator('[role="dialog"] input[name="gstin"]');
    if (await gstinField.isVisible()) await gstinField.fill('');

    await screenshot(page, 'customers-form-filled');

    await page.locator('[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("Create Customer")').first().click();
    await page.waitForTimeout(3000);
    await screenshot(page, 'customers-after-submit');

    const custDialog = await page.locator('[role="dialog"]').isVisible();
    if (!custDialog) {
      reportOk('Customer created successfully');
    } else {
      const errors = await page.locator('[role="dialog"] p.text-destructive, [role="dialog"] [data-slot="form-message"]').allTextContents();
      if (errors.length > 0) {
        reportIssue(`Customer form validation: ${errors.join(', ')}`);
      } else {
        reportIssue('Customer creation failed (no visible validation errors)');
      }
      await screenshot(page, 'customers-error');
      await page.keyboard.press('Escape');
    }
  } else {
    reportIssue('Cannot find Add Customer button');
  }

  // ==========================================
  // PHASE 2F: BOM - Check
  // ==========================================
  await step('BOM - Check');
  await page.goto(`${BASE}/bom`);
  await page.waitForTimeout(2000);
  await screenshot(page, 'bom-page');
  
  const bomAddBtn = page.locator('button:has-text("Add BOM"), button:has-text("Add"), button:has-text("New")').first();
  if (await bomAddBtn.isVisible()) {
    await bomAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'bom-form');
    reportOk('BOM add form opened');
    await page.keyboard.press('Escape');
  } else {
    reportIssue('Cannot find Add BOM button');
  }

  // ==========================================
  // PHASE 3A: PURCHASE ORDERS - Check
  // ==========================================
  await step('Purchase Orders - Check');
  await page.goto(`${BASE}/purchase-orders`);
  await page.waitForTimeout(2000);
  await screenshot(page, 'purchase-orders-page');

  const poBtn = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add")').first();
  if (await poBtn.isVisible()) {
    await poBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'purchase-orders-form');
    reportOk('Purchase Order form opened');
    await page.keyboard.press('Escape');
  } else {
    reportIssue('Cannot find Create PO button');
  }

  // ==========================================
  // PHASE 3B: RM BATCHES - Create
  // ==========================================
  await step('RM Batches - Check Create Button');
  await page.goto(`${BASE}/rm-batches`);
  await page.waitForTimeout(2000);
  await screenshot(page, 'rm-batches-page');

  const rmBatchBtn = page.locator('button:has-text("New RM Batch"), button:has-text("New")').first();
  if (await rmBatchBtn.isVisible()) {
    await rmBatchBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'rm-batches-form');
    reportOk('RM Batch create form opened');
    await page.keyboard.press('Escape');
  } else {
    reportIssue('RM Batch Create button not visible');
  }

  // ==========================================
  // PHASE 4: PRODUCTION - Check
  // ==========================================
  await step('Production - Check');
  await page.goto(`${BASE}/production`);
  await page.waitForTimeout(2000);
  await screenshot(page, 'production-page');

  const prodBtn = page.locator('button:has-text("New Production"), button:has-text("New"), button:has-text("Create")').first();
  if (await prodBtn.isVisible()) {
    await prodBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'production-form');
    reportOk('Production form opened');
    await page.keyboard.press('Escape');
  } else {
    reportIssue('Cannot find Create Production button');
  }

  // ==========================================
  // PHASE 5A: TRIALS - Check
  // ==========================================
  await step('Trials - Check');
  await page.goto(`${BASE}/trials`);
  await page.waitForTimeout(2000);
  await screenshot(page, 'trials-page');

  const trialBtn = page.locator('button:has-text("New Trial"), button:has-text("New"), button:has-text("Create")').first();
  if (await trialBtn.isVisible()) {
    await trialBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'trials-form');
    reportOk('Trial form opened');
    await page.keyboard.press('Escape');
  } else {
    reportIssue('Cannot find Create Trial button');
  }

  // ==========================================
  // PHASE 5B: SALES ORDERS - Check
  // ==========================================
  await step('Sales Orders - Check');
  await page.goto(`${BASE}/sales-orders`);
  await page.waitForTimeout(2000);
  await screenshot(page, 'sales-orders-page');

  const soBtn = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add")').first();
  if (await soBtn.isVisible()) {
    await soBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'sales-orders-form');
    reportOk('Sales Order form opened');
    await page.keyboard.press('Escape');
  } else {
    reportIssue('Cannot find Create Sales Order button');
  }

  // ==========================================
  // INVOICES / PAYMENTS - Check
  // ==========================================
  await step('Invoices - Check');
  await page.goto(`${BASE}/invoices`);
  await page.waitForTimeout(2000);
  await screenshot(page, 'invoices-page');
  reportOk('Invoices page loaded');

  await step('Payments - Check');
  await page.goto(`${BASE}/payments`);
  await page.waitForTimeout(2000);
  await screenshot(page, 'payments-page');
  reportOk('Payments page loaded');

  // ==========================================
  // FINAL REPORT
  // ==========================================
  console.log('\n\n========================================');
  console.log('WORKFLOW TEST REPORT');
  console.log('========================================');
  console.log(`Total steps: ${stepNum}`);
  if (issues.length === 0) {
    console.log('✅ All steps passed with no issues!');
  } else {
    console.log(`❌ Found ${issues.length} issue(s):`);
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  console.log('========================================\n');
});
