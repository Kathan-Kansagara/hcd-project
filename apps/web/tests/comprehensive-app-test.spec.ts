/**
 * Comprehensive E2E test for Zenon CropTrial application
 * Tests login, all pages, and create flows for product and raw material
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');
const REPORT: Record<string, { loaded: boolean; errors: string[]; notes: string }> = {};

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Comprehensive Zenon CropTrial E2E Test', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    // Clean report
    Object.keys(REPORT).forEach((k) => delete REPORT[k]);
  });

  test('1. Login page loads correctly', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' && !text.includes('baseline-browser-mapping')) {
        consoleErrors.push(text);
      }
    });

    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');

    const hasLoginForm = await page.getByLabel('Email Address').isVisible();
    const hasPasswordField = await page.getByLabel('Password').isVisible();
    const hasSignInButton = await page.getByRole('button', { name: /sign in/i }).isVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-page.png'), fullPage: true });

    REPORT['login'] = {
      loaded: hasLoginForm && hasPasswordField && hasSignInButton,
      errors: consoleErrors,
      notes: hasLoginForm ? 'Login form visible' : 'Login form not found',
    };

    expect(hasLoginForm).toBeTruthy();
    expect(hasPasswordField).toBeTruthy();
    expect(hasSignInButton).toBeTruthy();
  });

  test('2. Login with admin credentials', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('baseline-browser-mapping')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email Address').fill('admin@zenon.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect to dashboard (SmartRedirect goes to /dashboard for admin)
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-login.png'), fullPage: true });

    const hasDashboard = await page.getByRole('heading', { name: /dashboard/i }).isVisible().catch(() => false);
    const hasSidebar = await page.getByRole('navigation').isVisible().catch(() => false);

    REPORT['login-success'] = {
      loaded: hasDashboard || hasSidebar,
      errors: consoleErrors,
      notes: hasDashboard ? 'Redirected to dashboard' : 'Check redirect',
    };

    expect(hasDashboard || hasSidebar).toBeTruthy();
  });

  test('3. Dashboard page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/dashboard', errs);
    const result = await capturePageReport(
      page,
      '03-dashboard',
      'Dashboard',
      [() => page.getByRole('heading', { name: /dashboard/i }).isVisible()],
      errs
    );
    REPORT['dashboard'] = result;
  });

  test('4. Farmers page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/farmers', errs);
    const result = await capturePageReport(
      page,
      '04-farmers',
      'Farmers',
      [
        () => page.getByRole('heading', { name: /farmers/i }).isVisible(),
        () => page.getByRole('table').isVisible().catch(() => false),
      ],
      errs
    );
    REPORT['farmers'] = result;
  });

  test('5. Products page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/products', errs);
    const result = await capturePageReport(
      page,
      '05-products',
      'Products',
      [
        () => page.getByRole('heading', { name: /products/i }).isVisible(),
        () => page.getByRole('button', { name: /new product/i }).isVisible().catch(() => false),
        () => page.getByRole('table').isVisible().catch(() => false),
      ],
      errs
    );
    REPORT['products'] = result;
  });

  test('6. Raw Materials page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/raw-materials', errs);
    const result = await capturePageReport(
      page,
      '06-raw-materials',
      'Raw Materials',
      [
        () => page.getByRole('heading', { name: /raw materials/i }).isVisible(),
        () => page.getByRole('button', { name: /new raw material/i }).isVisible().catch(() => false),
        () => page.getByRole('table').isVisible().catch(() => false),
      ],
      errs
    );
    REPORT['raw-materials'] = result;
  });

  test('7. BOM page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/bom', errs);
    const result = await capturePageReport(
      page,
      '07-bom',
      'BOM',
      [() => page.getByRole('heading', { name: /bom|bill of material/i }).isVisible()],
      errs
    );
    REPORT['bom'] = result;
  });

  test('8. Suppliers page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/suppliers', errs);
    const result = await capturePageReport(
      page,
      '08-suppliers',
      'Suppliers',
      [
        () => page.getByRole('heading', { name: /suppliers/i }).isVisible(),
        () => page.getByRole('table').isVisible().catch(() => false),
      ],
      errs
    );
    REPORT['suppliers'] = result;
  });

  test('9. Customers page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/customers', errs);
    const result = await capturePageReport(
      page,
      '09-customers',
      'Customers',
      [
        () => page.getByRole('heading', { name: /customers/i }).isVisible(),
        () => page.getByRole('table').isVisible().catch(() => false),
      ],
      errs
    );
    REPORT['customers'] = result;
  });

  test('10. Purchase Orders page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/purchase-orders', errs);
    const result = await capturePageReport(
      page,
      '10-purchase-orders',
      'Purchase Orders',
      [() => page.getByRole('heading', { name: /purchase orders/i }).isVisible()],
      errs
    );
    REPORT['purchase-orders'] = result;
  });

  test('11. RM Batches page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/rm-batches', errs);
    const result = await capturePageReport(
      page,
      '11-rm-batches',
      'RM Batches',
      [() => page.getByRole('heading', { name: /raw material batches/i }).isVisible()],
      errs
    );
    REPORT['rm-batches'] = result;
  });

  test('12. Trials page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/trials', errs);
    const result = await capturePageReport(
      page,
      '12-trials',
      'Trials',
      [() => page.getByRole('heading', { name: /trials/i }).isVisible()],
      errs
    );
    REPORT['trials'] = result;
  });

  test('13. Sales Orders page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/sales-orders', errs);
    const result = await capturePageReport(
      page,
      '13-sales-orders',
      'Sales Orders',
      [() => page.getByRole('heading', { name: /sales orders/i }).isVisible()],
      errs
    );
    REPORT['sales-orders'] = result;
  });

  test('14. Invoices page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/invoices', errs);
    const result = await capturePageReport(
      page,
      '14-invoices',
      'Invoices',
      [() => page.getByRole('heading', { name: /invoices/i }).isVisible()],
      errs
    );
    REPORT['invoices'] = result;
  });

  test('15. Payments page', async ({ page }) => {
    const errs: string[] = [];
    await loginAndNavigate(page, '/payments', errs);
    const result = await capturePageReport(
      page,
      '15-payments',
      'Payments',
      [() => page.getByRole('heading', { name: /payments/i }).isVisible()],
      errs
    );
    REPORT['payments'] = result;
  });

  test('16. Create new product via UI', async ({ page }) => {
    await loginAndNavigate(page, '/products');

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('baseline-browser-mapping')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.getByRole('button', { name: /new product/i }).click();
    await page.waitForTimeout(500);

    const dialogVisible = await page.getByRole('dialog').isVisible();
    if (!dialogVisible) {
      REPORT['create-product'] = { loaded: false, errors: consoleErrors, notes: 'Dialog did not open' };
      return;
    }

    const timestamp = Date.now();
    const productName = `E2E Test Product ${timestamp}`;

    await page.getByLabel(/^name$/i).fill(productName);
    await page.getByLabel(/description/i).fill('E2E test description');
    await page.getByRole('button', { name: /create/i }).click();

    await page.waitForTimeout(2000);

    const successToast = await page.getByText(/created successfully|added successfully/i).isVisible().catch(() => false);
    const inTable = await page.getByRole('cell', { name: productName }).isVisible().catch(() => false);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16-create-product.png'), fullPage: true });

    REPORT['create-product'] = {
      loaded: true,
      errors: consoleErrors,
      notes: successToast ? 'Product created successfully' : inTable ? 'Product in table' : 'Check creation',
    };

    expect(successToast || inTable).toBeTruthy();
  });

  test('17. Create new raw material via UI', async ({ page }) => {
    await loginAndNavigate(page, '/raw-materials');

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('baseline-browser-mapping')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.getByRole('button', { name: /new raw material/i }).click();
    await page.waitForTimeout(500);

    const dialogVisible = await page.getByRole('dialog').isVisible();
    if (!dialogVisible) {
      REPORT['create-raw-material'] = { loaded: false, errors: consoleErrors, notes: 'Dialog did not open' };
      return;
    }

    const timestamp = Date.now();
    const rmName = `E2E Test RM ${timestamp}`;

    await page.getByLabel(/^name \*/i).fill(rmName);
    // Category - click combobox and select first option
    await page.getByRole('combobox').first().click();
    await page.waitForTimeout(300);
    await page.getByRole('option').first().click();
    // Unit - click second combobox and select first option
    await page.getByRole('combobox').nth(1).click();
    await page.waitForTimeout(300);
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /create/i }).click();

    await page.waitForTimeout(2000);

    const successToast = await page.getByText(/created successfully|added successfully/i).isVisible().catch(() => false);
    const inTable = await page.getByRole('cell', { name: rmName }).isVisible().catch(() => false);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17-create-raw-material.png'), fullPage: true });

    REPORT['create-raw-material'] = {
      loaded: true,
      errors: consoleErrors,
      notes: successToast ? 'Raw material created successfully' : inTable ? 'RM in table' : 'Check creation',
    };

    expect(successToast || inTable).toBeTruthy();
  });

  test.afterAll(async () => {
    // Write report to file
    const reportPath = path.join(SCREENSHOT_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(REPORT, null, 2));
    console.log('\n=== Test Report ===');
    console.log(JSON.stringify(REPORT, null, 2));
    console.log(`\nReport saved to ${reportPath}`);
    console.log(`Screenshots saved to ${SCREENSHOT_DIR}`);
  });
});

async function loginAndNavigate(page: any, targetPath: string, consoleErrors?: string[]) {
  if (consoleErrors) {
    page.on('console', (msg: any) => {
      if (msg.type() === 'error' && !msg.text().includes('baseline-browser-mapping')) {
        consoleErrors.push(msg.text());
      }
    });
  }
  await page.goto('http://localhost:5173/login');
  await page.getByLabel('Email Address').fill('admin@zenon.com');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|farmers|products|raw-materials|bom|suppliers|customers|purchase-orders|rm-batches|trials|sales-orders|invoices|payments)?/, {
    timeout: 15000,
  });
  await page.goto(`http://localhost:5173${targetPath}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

async function capturePageReport(
  page: any,
  screenshotName: string,
  pageName: string,
  visibilityChecks: (() => Promise<boolean>)[],
  consoleErrors: string[] = []
): Promise<{ loaded: boolean; errors: string[]; notes: string }> {
  const results = await Promise.all(visibilityChecks.map((fn) => fn()));
  const allPassed = results.every(Boolean);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${screenshotName}.png`), fullPage: true });

  return {
    loaded: allPassed,
    errors: [...consoleErrors],
    notes: allPassed ? `${pageName} loaded correctly` : `Some elements not visible: ${results.map((r, i) => (r ? 'ok' : `check${i}`)).join(', ')}`,
  };
}
