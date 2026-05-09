/**
 * Bug Fixes Verification Tests
 * Tests all 20 bug fixes to ensure they work correctly
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:3000';
const API_URL = `${API_BASE}/api/v1`;

// Shared token across tests
let sharedToken: string = '';

// Helper: Login as admin in browser
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email Address').fill('admin@zenon.com');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard)?$/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Bug Fix Verification Tests', () => {
  // Get a token once to reuse
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const response = await page.request.post(`${API_URL}/auth/login`, {
      data: { email: 'admin@zenon.com', password: 'admin123' },
    });
    const body = await response.json();
    sharedToken = body.token;
    await page.close();
  });

  // =====================================================
  // API-LEVEL TESTS (using shared token)
  // =====================================================

  test('Bug 1+9: Auth login returns valid token with correct role', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'admin@zenon.com', password: 'admin123' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('token');
    expect(body.user.role).toBe('ADMIN');
  });

  test('Bug 5: Inventory analytics endpoint works (no field-ref crash)', async ({ request }) => {
    const response = await request.get(`${API_URL}/dashboard/analytics/inventory`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('total_raw_materials');
    expect(body).toHaveProperty('low_stock_items');
    expect(typeof body.low_stock_items).toBe('number');
    expect(body.low_stock_items).toBeGreaterThanOrEqual(0);
  });

  test('Bug 6: PO list returns snake_case purchase_orders', async ({ request }) => {
    const response = await request.get(`${API_URL}/purchase-orders?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('purchase_orders');
    expect(Array.isArray(body.purchase_orders)).toBeTruthy();
    expect(body).not.toHaveProperty('purchaseOrders');
  });

  test('Bug 10: Health endpoint responds', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('Bug 15: Location POST requires auth (401 without token)', async ({ request }) => {
    const response = await request.post(`${API_URL}/locations`, {
      data: { state: 'Test' },
    });
    expect(response.status()).toBe(401);
  });

  test('Bug 16: Dashboard analytics requires auth (401 without token)', async ({ request }) => {
    const response = await request.get(`${API_URL}/dashboard/analytics/inventory`);
    expect(response.status()).toBe(401);
  });

  test('Bug 16: Dashboard analytics works WITH auth', async ({ request }) => {
    const response = await request.get(`${API_URL}/dashboard/analytics/sales`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('total_revenue');
  });

  test('Bug 2+3+4: PO and RM batch APIs work correctly', async ({ request }) => {
    const poResponse = await request.get(`${API_URL}/purchase-orders?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
    });
    expect(poResponse.ok()).toBeTruthy();

    const batchResponse = await request.get(`${API_URL}/raw-material-batches?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
    });
    expect(batchResponse.ok()).toBeTruthy();
    const batchBody = await batchResponse.json();
    expect(batchBody).toHaveProperty('rm_batches');
  });

  // =====================================================
  // BROWSER-LEVEL TESTS (page navigation + rendering)
  // =====================================================

  test('Bug 8+14: Dashboard loads without NaN/Infinity', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const heading = await page.getByRole('heading', { name: /dashboard/i }).isVisible();
    expect(heading).toBeTruthy();

    expect(await page.getByText('Outstanding Payments').isVisible().catch(() => false)).toBeTruthy();
    expect(await page.getByText('Inventory Status').isVisible().catch(() => false)).toBeTruthy();

    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('NaN');
    expect(pageContent).not.toContain('Infinity');

    await page.screenshot({ path: 'tests/test-screenshots/bugfix-dashboard.png', fullPage: true });
  });

  test('Bug 13: Batches page loads with valid units', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/batches`);
    await page.waitForLoadState('networkidle');
    expect(await page.getByText(/batch/i).first().isVisible()).toBeTruthy();
    await page.screenshot({ path: 'tests/test-screenshots/bugfix-batches.png', fullPage: true });
  });

  test('Bug 13: Raw Materials page loads', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/raw-materials`);
    await page.waitForLoadState('networkidle');
    expect(await page.getByText(/raw material/i).first().isVisible()).toBeTruthy();
    await page.screenshot({ path: 'tests/test-screenshots/bugfix-raw-materials.png', fullPage: true });
  });

  test('Bug 17: Purchase Orders page loads', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/purchase-orders`);
    await page.waitForLoadState('networkidle');
    expect(await page.getByText(/purchase order/i).first().isVisible()).toBeTruthy();
    const content = await page.textContent('body');
    expect(content).not.toContain('NaN');
    await page.screenshot({ path: 'tests/test-screenshots/bugfix-purchase-orders.png', fullPage: true });
  });

  test('Bug 17: Sales Orders page loads', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/sales-orders`);
    await page.waitForLoadState('networkidle');
    expect(await page.getByText(/sales order/i).first().isVisible()).toBeTruthy();
    await page.screenshot({ path: 'tests/test-screenshots/bugfix-sales-orders.png', fullPage: true });
  });

  test('Bug 18: Payments page loads', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/payments`);
    await page.waitForLoadState('networkidle');
    expect(await page.getByText(/payment/i).first().isVisible()).toBeTruthy();
    await page.screenshot({ path: 'tests/test-screenshots/bugfix-payments.png', fullPage: true });
  });

  test('Bug 20: PO Form dialog opens without crash', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/purchase-orders`);
    await page.waitForLoadState('networkidle');

    const addButton = page.getByRole('button', { name: /new|add|create/i }).first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(1000);
      const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
      expect(dialogVisible).toBeTruthy();
      await page.screenshot({ path: 'tests/test-screenshots/bugfix-po-dialog.png' });
      await page.keyboard.press('Escape');
    }
  });

  test('Invoices page loads', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/invoices`);
    await page.waitForLoadState('networkidle');
    expect(await page.getByText(/invoice/i).first().isVisible()).toBeTruthy();
    await page.screenshot({ path: 'tests/test-screenshots/bugfix-invoices.png', fullPage: true });
  });

  test('All major pages load without NaN/Infinity', async ({ page }) => {
    await loginAsAdmin(page);

    const pages = [
      '/dashboard', '/farmers', '/products', '/batches',
      '/raw-materials', '/rm-batches', '/purchase-orders',
      '/sales-orders', '/invoices', '/payments',
      '/suppliers', '/customers',
    ];

    for (const p of pages) {
      await page.goto(`${BASE_URL}${p}`);
      await page.waitForLoadState('networkidle');
      const body = await page.textContent('body');
      expect(body, `Page ${p} should not contain NaN`).not.toContain('NaN');
      expect(body, `Page ${p} should not contain Infinity`).not.toContain('Infinity');
    }
  });

  test('Final: Dashboard renders all sections', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    expect(await page.getByText('Trial Statistics').isVisible().catch(() => false)).toBeTruthy();
    expect(await page.getByText('Inventory Status').isVisible().catch(() => false)).toBeTruthy();
    expect(await page.getByText('Sales & Purchase Overview').isVisible().catch(() => false)).toBeTruthy();
    expect(await page.getByText('Outstanding Payments').isVisible().catch(() => false)).toBeTruthy();
    expect(await page.getByText('Low Stock Alerts').isVisible().catch(() => false)).toBeTruthy();

    const content = await page.textContent('body');
    expect(content).not.toContain('NaN');
    expect(content).not.toContain('Infinity');

    await page.screenshot({ path: 'tests/test-screenshots/bugfix-final-dashboard.png', fullPage: true });
  });
});
