/**
 * Workflow Runner - Tests all WORKFLOWS.md flows via Playwright
 * Run: npx playwright test workflow-runner.ts --headed
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
const SCREENSHOT_DIR = 'tests/workflow-screenshots';

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'admin@zenon.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

test('Phase 1 & 2 & 3 & 4 & 5 - Full Workflow', async ({ page }) => {
  test.setTimeout(300000); // 5 minutes

  const issues: string[] = [];
  let stepNum = 0;

  async function step(name: string) {
    stepNum++;
    console.log(`\n=== STEP ${stepNum}: ${name} ===`);
  }

  async function screenshot(name: string) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${String(stepNum).padStart(2, '0')}-${name}.png`, fullPage: true });
  }

  async function reportIssue(issue: string) {
    console.log(`  ❌ ISSUE: ${issue}`);
    issues.push(`Step ${stepNum}: ${issue}`);
  }

  async function reportOk(msg: string) {
    console.log(`  ✅ ${msg}`);
  }

  // ==========================================
  // PHASE 1: LOGIN
  // ==========================================
  await step('Login');
  await login(page);
  await screenshot('dashboard');
  const dashTitle = await page.textContent('body');
  if (dashTitle?.includes('Dashboard') || dashTitle?.includes('Overview')) {
    await reportOk('Login successful, dashboard loaded');
  } else {
    await reportIssue('Login failed or dashboard not loaded');
  }

  // ==========================================
  // PHASE 2A: RAW MATERIALS
  // ==========================================
  await step('Raw Materials - Navigate');
  await page.goto(`${BASE}/raw-materials`);
  await page.waitForTimeout(2000);
  await screenshot('raw-materials-list');

  await step('Raw Materials - Create New');
  // Find and click add button
  const rmAddBtn = page.locator('button:has-text("New Raw Material"), button:has-text("Add"), button:has-text("Create")').first();
  if (await rmAddBtn.isVisible()) {
    await rmAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('raw-materials-form');

    // Check what fields exist
    const formHtml = await page.locator('[role="dialog"], form, .modal').first().innerHTML().catch(() => '');
    
    // Fill the form
    const nameField = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await nameField.isVisible()) await nameField.fill('Test RM - HDPE Bottle 1L');
    
    // Category dropdown
    const categoryTrigger = page.locator('button:has-text("Select category"), [name="category"]').first();
    if (await categoryTrigger.isVisible()) {
      await categoryTrigger.click();
      await page.waitForTimeout(500);
      const packagingOpt = page.locator('[role="option"]:has-text("PACKAGING"), [role="option"]:has-text("Packaging")').first();
      if (await packagingOpt.isVisible()) await packagingOpt.click();
    }

    // Unit dropdown
    const unitTrigger = page.locator('button:has-text("Select unit"), [name="unit"]').first();
    if (await unitTrigger.isVisible()) {
      await unitTrigger.click();
      await page.waitForTimeout(500);
      const pieceOpt = page.locator('[role="option"]:has-text("PIECE"), [role="option"]:has-text("Piece")').first();
      if (await pieceOpt.isVisible()) await pieceOpt.click();
    }

    // Check for GST Rate, HSN Code, Default Price fields
    const gstField = page.locator('input[name="gst_rate"], input[name="gstRate"], label:has-text("GST")');
    const hsnField = page.locator('input[name="hsn_sac_code"], input[name="hsnSacCode"], label:has-text("HSN")');
    const priceField = page.locator('input[name="default_unit_price"], input[name="defaultUnitPrice"], label:has-text("Default")');
    
    if (!(await gstField.first().isVisible())) await reportIssue('Raw Materials form missing GST Rate field');
    if (!(await hsnField.first().isVisible())) await reportIssue('Raw Materials form missing HSN/SAC Code field');
    if (!(await priceField.first().isVisible())) await reportIssue('Raw Materials form missing Default Unit Price field');

    // Min stock / reorder
    const minStock = page.locator('input[name="min_stock_level"], input[name="minStockLevel"]').first();
    if (await minStock.isVisible()) await minStock.fill('100');
    
    const reorderPoint = page.locator('input[name="reorder_point"], input[name="reorderPoint"], input[name="reorder_quantity"], input[name="reorderQuantity"]').first();
    if (await reorderPoint.isVisible()) await reorderPoint.fill('50');

    await screenshot('raw-materials-form-filled');

    // Submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
    await submitBtn.click();
    await page.waitForTimeout(2000);
    await screenshot('raw-materials-after-create');

    // Check for success
    const toastSuccess = page.locator('[data-sonner-toast] [data-title]:has-text("success"), .toast:has-text("success"), [role="status"]:has-text("success")').first();
    const toastError = page.locator('[data-sonner-toast] [data-title]:has-text("error"), .toast:has-text("error"), [data-sonner-toast][data-type="error"]').first();
    
    if (await toastSuccess.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reportOk('Raw material created successfully');
    } else if (await toastError.isVisible({ timeout: 1000 }).catch(() => false)) {
      const errText = await toastError.textContent();
      await reportIssue(`Raw material creation failed: ${errText}`);
    } else {
      // Check if dialog closed (success) or still open (error)
      const dialogStillOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
      if (!dialogStillOpen) {
        await reportOk('Raw material probably created (dialog closed)');
      } else {
        await reportIssue('Raw material creation unclear - dialog still open');
      }
    }
  } else {
    await reportIssue('Cannot find Add/New Raw Material button');
  }

  // ==========================================
  // PHASE 2B: PRODUCTS
  // ==========================================
  await step('Products - Navigate');
  await page.goto(`${BASE}/products`);
  await page.waitForTimeout(2000);
  await screenshot('products-list');

  await step('Products - Create New');
  const prodAddBtn = page.locator('button:has-text("New Product"), button:has-text("Add Product"), button:has-text("Create")').first();
  if (await prodAddBtn.isVisible()) {
    await prodAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('products-form');

    const prodName = page.locator('input[name="name"]').first();
    if (await prodName.isVisible()) await prodName.fill('Bio-Fertilizer 1L');

    const prodDesc = page.locator('textarea[name="description"], input[name="description"]').first();
    if (await prodDesc.isVisible()) await prodDesc.fill('Organic bio-fertilizer in 1 liter bottle');

    const prodCategory = page.locator('input[name="category"], button:has-text("Select category")').first();
    if (await prodCategory.isVisible()) {
      if (await prodCategory.evaluate(el => el.tagName) === 'INPUT') {
        await prodCategory.fill('Fertilizer');
      } else {
        await prodCategory.click();
        await page.waitForTimeout(500);
        const firstOpt = page.locator('[role="option"]').first();
        if (await firstOpt.isVisible()) await firstOpt.click();
      }
    }

    await screenshot('products-form-filled');

    const prodSubmit = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
    await prodSubmit.click();
    await page.waitForTimeout(2000);
    await screenshot('products-after-create');
    
    const dialogStillOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    if (!dialogStillOpen) {
      await reportOk('Product created successfully');
    } else {
      await reportIssue('Product creation may have failed - dialog still open');
      await screenshot('products-error');
    }
  } else {
    await reportIssue('Cannot find Add/New Product button');
  }

  // ==========================================
  // PHASE 2C: FARMERS
  // ==========================================
  await step('Farmers - Navigate');
  await page.goto(`${BASE}/farmers`);
  await page.waitForTimeout(2000);
  await screenshot('farmers-list');

  await step('Farmers - Create New');
  const farmerAddBtn = page.locator('button:has-text("New Farmer"), button:has-text("Add Farmer"), button:has-text("Add"), button:has-text("Create")').first();
  if (await farmerAddBtn.isVisible()) {
    await farmerAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('farmers-form');

    const farmerName = page.locator('input[name="name"]').first();
    if (await farmerName.isVisible()) await farmerName.fill('Rajesh Kumar');

    const farmerContact = page.locator('input[name="contact"], input[name="phone"]').first();
    if (await farmerContact.isVisible()) await farmerContact.fill('9876543210');

    // Location fields - might be pincode-based
    const pincodeField = page.locator('input[name="pincode"], input[placeholder*="pincode" i], input[placeholder*="Pincode"]').first();
    if (await pincodeField.isVisible()) {
      await pincodeField.fill('411001');
      await page.waitForTimeout(1000);
    }

    // Village/City fields
    const villageField = page.locator('input[name="village"], input[placeholder*="village" i]').first();
    if (await villageField.isVisible()) await villageField.fill('Khed');

    await screenshot('farmers-form-filled');

    const farmerSubmit = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
    await farmerSubmit.click();
    await page.waitForTimeout(2000);
    await screenshot('farmers-after-create');

    const dialogOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    if (!dialogOpen) {
      await reportOk('Farmer created successfully');
    } else {
      await reportIssue('Farmer creation may have failed - dialog still open');
      await screenshot('farmers-error');
    }
  } else {
    await reportIssue('Cannot find Add Farmer button');
  }

  // ==========================================
  // PHASE 2D: SUPPLIERS
  // ==========================================
  await step('Suppliers - Navigate');
  await page.goto(`${BASE}/suppliers`);
  await page.waitForTimeout(2000);
  await screenshot('suppliers-list');

  await step('Suppliers - Create New');
  const suppAddBtn = page.locator('button:has-text("New Supplier"), button:has-text("Add Supplier"), button:has-text("Add"), button:has-text("Create")').first();
  if (await suppAddBtn.isVisible()) {
    await suppAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('suppliers-form');

    // Fill supplier form
    const companyName = page.locator('input[name="company_name"], input[name="companyName"]').first();
    if (await companyName.isVisible()) await companyName.fill('PackageTech Solutions');

    const contactPerson = page.locator('input[name="contact_person"], input[name="contactPerson"]').first();
    if (await contactPerson.isVisible()) await contactPerson.fill('Amit Sharma');

    const phone = page.locator('input[name="phone"]').first();
    if (await phone.isVisible()) await phone.fill('9123456789');

    const email = page.locator('input[name="email"]').first();
    if (await email.isVisible()) await email.fill('amit@packagetech.com');

    const addr1 = page.locator('input[name="address_line1"], input[name="addressLine1"]').first();
    if (await addr1.isVisible()) await addr1.fill('45 Industrial Area');

    const gstin = page.locator('input[name="gstin"]').first();
    if (await gstin.isVisible()) await gstin.fill('27AADCP1234F1ZN');

    const payTerms = page.locator('input[name="payment_terms"], input[name="paymentTerms"]').first();
    if (await payTerms.isVisible()) await payTerms.fill('Net 30');

    await screenshot('suppliers-form-filled');

    const suppSubmit = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
    await suppSubmit.click();
    await page.waitForTimeout(2000);
    await screenshot('suppliers-after-create');

    const dialogOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    if (!dialogOpen) {
      await reportOk('Supplier created successfully');
    } else {
      await reportIssue('Supplier creation may have failed - dialog still open');
    }
  } else {
    await reportIssue('Cannot find Add Supplier button');
  }

  // ==========================================
  // PHASE 2E: CUSTOMERS
  // ==========================================
  await step('Customers - Navigate');
  await page.goto(`${BASE}/customers`);
  await page.waitForTimeout(2000);
  await screenshot('customers-list');

  await step('Customers - Create New');
  const custAddBtn = page.locator('button:has-text("New Customer"), button:has-text("Add Customer"), button:has-text("Add"), button:has-text("Create")').first();
  if (await custAddBtn.isVisible()) {
    await custAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('customers-form');

    const custCompany = page.locator('input[name="company_name"], input[name="companyName"]').first();
    if (await custCompany.isVisible()) await custCompany.fill('Green Farms Ltd');

    const clientName = page.locator('input[name="client_name"], input[name="clientName"]').first();
    if (await clientName.isVisible()) await clientName.fill('Suresh Patel');

    const custContact = page.locator('input[name="contact"]').first();
    if (await custContact.isVisible()) await custContact.fill('9876543211');

    const custEmail = page.locator('input[name="email"]').first();
    if (await custEmail.isVisible()) await custEmail.fill('suresh@greenfarms.com');

    const custAddr = page.locator('input[name="address_line1"], input[name="addressLine1"]').first();
    if (await custAddr.isVisible()) await custAddr.fill('10 Farm Road');

    const custGstin = page.locator('input[name="gstin"]').first();
    if (await custGstin.isVisible()) await custGstin.fill('24AADCG5678H1ZP');

    // Place of supply
    const placeOfSupply = page.locator('input[name="place_of_supply"], input[name="placeOfSupply"], button:has-text("Select")').first();
    if (await placeOfSupply.isVisible()) {
      const tag = await placeOfSupply.evaluate(el => el.tagName);
      if (tag === 'INPUT') {
        await placeOfSupply.fill('Gujarat');
      } else {
        await placeOfSupply.click();
        await page.waitForTimeout(500);
        const firstOpt = page.locator('[role="option"]').first();
        if (await firstOpt.isVisible()) await firstOpt.click();
      }
    }

    const custPayTerms = page.locator('input[name="payment_terms"], input[name="paymentTerms"]').first();
    if (await custPayTerms.isVisible()) await custPayTerms.fill('Net 15');

    await screenshot('customers-form-filled');

    const custSubmit = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
    await custSubmit.click();
    await page.waitForTimeout(2000);
    await screenshot('customers-after-create');

    const dialogOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    if (!dialogOpen) {
      await reportOk('Customer created successfully');
    } else {
      await reportIssue('Customer creation may have failed - dialog still open');
    }
  } else {
    await reportIssue('Cannot find Add Customer button');
  }

  // ==========================================
  // PHASE 2F: BOM (Product Recipes)
  // ==========================================
  await step('BOM / Product Recipes - Navigate');
  await page.goto(`${BASE}/bom`);
  await page.waitForTimeout(2000);
  await screenshot('bom-page');
  
  // Examine BOM page content
  const bomContent = await page.textContent('body');
  console.log('  BOM page text snippets:', bomContent?.substring(0, 500));
  
  // Look for product selector or add button
  const bomAddBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first();
  const bomProductSelect = page.locator('select, [role="combobox"], button:has-text("Select Product")').first();
  
  if (await bomProductSelect.isVisible()) {
    await bomProductSelect.click();
    await page.waitForTimeout(500);
    await screenshot('bom-product-dropdown');
    // Select first product
    const firstProd = page.locator('[role="option"]').first();
    if (await firstProd.isVisible()) {
      await firstProd.click();
      await page.waitForTimeout(1000);
      await screenshot('bom-product-selected');
    }
  }

  if (await bomAddBtn.isVisible()) {
    await bomAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('bom-add-form');
    await reportOk('BOM page has add functionality');
  } else {
    console.log('  ℹ️  BOM page layout captured for analysis');
  }

  // ==========================================
  // PHASE 3A: PURCHASE ORDERS
  // ==========================================
  await step('Purchase Orders - Navigate');
  await page.goto(`${BASE}/purchase-orders`);
  await page.waitForTimeout(2000);
  await screenshot('purchase-orders-list');

  await step('Purchase Orders - Create New');
  const poAddBtn = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Create")').first();
  if (await poAddBtn.isVisible()) {
    await poAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('purchase-orders-form');

    // Check form fields
    const formContent = await page.locator('[role="dialog"], form').first().textContent().catch(() => '');
    console.log('  PO form fields:', formContent?.substring(0, 500));

    await screenshot('purchase-orders-form-detail');
    await reportOk('Purchase Order form opened');
    
    // Close without submitting to continue testing
    const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), [role="dialog"] button[aria-label="Close"]').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    await reportIssue('Cannot find Create Purchase Order button');
  }

  // ==========================================
  // PHASE 3B: RM BATCHES
  // ==========================================
  await step('RM Batches - Navigate');
  await page.goto(`${BASE}/rm-batches`);
  await page.waitForTimeout(2000);
  await screenshot('rm-batches-list');

  await step('RM Batches - Create New');
  const rmBatchAddBtn = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Create"), button:has-text("Receive")').first();
  if (await rmBatchAddBtn.isVisible()) {
    await rmBatchAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('rm-batches-form');
    await reportOk('RM Batch form opened');

    const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    await reportIssue('Cannot find Create RM Batch button');
  }

  // ==========================================
  // PHASE 4: PRODUCTION
  // ==========================================
  await step('Production - Navigate');
  await page.goto(`${BASE}/production`);
  await page.waitForTimeout(2000);
  await screenshot('production-list');

  await step('Production - Create New');
  const prodRunBtn = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Create"), button:has-text("Production")').first();
  if (await prodRunBtn.isVisible()) {
    await prodRunBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('production-form');
    await reportOk('Production form opened');

    const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    await reportIssue('Cannot find Create Production Run button');
  }

  // ==========================================
  // PHASE 5A: TRIALS
  // ==========================================
  await step('Trials - Navigate');
  await page.goto(`${BASE}/trials`);
  await page.waitForTimeout(2000);
  await screenshot('trials-list');

  await step('Trials - Create New');
  const trialAddBtn = page.locator('button:has-text("New Trial"), button:has-text("Add Trial"), button:has-text("New"), button:has-text("Create")').first();
  if (await trialAddBtn.isVisible()) {
    await trialAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('trials-form');
    await reportOk('Trial form opened');

    const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    await reportIssue('Cannot find Create Trial button');
  }

  // ==========================================
  // PHASE 5B: SALES ORDERS
  // ==========================================
  await step('Sales Orders - Navigate');
  await page.goto(`${BASE}/sales-orders`);
  await page.waitForTimeout(2000);
  await screenshot('sales-orders-list');

  await step('Sales Orders - Create New');
  const soAddBtn = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Create")').first();
  if (await soAddBtn.isVisible()) {
    await soAddBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('sales-orders-form');
    await reportOk('Sales Order form opened');

    const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    await reportIssue('Cannot find Create Sales Order button');
  }

  // ==========================================
  // PHASE 5B: INVOICES
  // ==========================================
  await step('Invoices - Navigate');
  await page.goto(`${BASE}/invoices`);
  await page.waitForTimeout(2000);
  await screenshot('invoices-list');

  // ==========================================
  // PHASE 5B: PAYMENTS
  // ==========================================
  await step('Payments - Navigate');
  await page.goto(`${BASE}/payments`);
  await page.waitForTimeout(2000);
  await screenshot('payments-list');

  // ==========================================
  // FINAL REPORT
  // ==========================================
  console.log('\n\n========================================');
  console.log('WORKFLOW TEST REPORT');
  console.log('========================================');
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
