/**
 * E2E Tests for Customer & Supplier UI
 *
 * These tests verify:
 * 1. Customer list page renders correctly
 * 2. Customer form submission works
 * 3. Supplier list page renders correctly
 * 4. Supplier form submission works
 *
 * Note: These are focused UI tests, not exhaustive component state testing
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:5173';
const API_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

// Helper function to login as admin
async function loginAsAdmin(page: any) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/`);
}

test.describe('Customer UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should render customer list page', async ({ page }) => {
    // Navigate to customers page
    await page.goto(`${BASE_URL}/customers`);

    // Verify page title
    await expect(page.locator('h1')).toContainText('Customers');

    // Verify table headers are present
    await expect(page.locator('th:has-text("Company Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Contact")')).toBeVisible();
    await expect(page.locator('th:has-text("Email")')).toBeVisible();

    // Verify "Add Customer" button exists
    await expect(page.locator('button:has-text("Add Customer")')).toBeVisible();

    // Verify search input exists
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should open customer form dialog when Add Customer is clicked', async ({ page }) => {
    await page.goto(`${BASE_URL}/customers`);

    // Click Add Customer button
    await page.click('button:has-text("Add Customer")');

    // Verify dialog opens
    await expect(page.locator('text=Add New Customer')).toBeVisible();

    // Verify form fields are present
    await expect(page.locator('input#company_name')).toBeVisible();
    await expect(page.locator('input#contact')).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#address_line1')).toBeVisible();
    await expect(page.locator('input#city')).toBeVisible();
    await expect(page.locator('input#state')).toBeVisible();

    // Verify action buttons
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('button:has-text("Create Customer")')).toBeVisible();
  });

  test('should validate required fields in customer form', async ({ page }) => {
    await page.goto(`${BASE_URL}/customers`);

    // Open form
    await page.click('button:has-text("Add Customer")');

    // Try to submit empty form
    await page.click('button:has-text("Create Customer")');

    // Verify validation errors appear
    await expect(page.locator('text=Company name is required')).toBeVisible({ timeout: 3000 });
  });

  test('should submit customer form successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/customers`);

    // Mock API response
    await page.route(`${API_URL}/customers`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            customer: {
              id: 'test-customer-id',
              company_name: 'Test Company',
              contact: '1234567890',
              email: 'test@example.com',
              address_line1: '123 Test St',
              city: 'Test City',
              state: 'Test State',
              pincode: '123456',
              place_of_supply: '24-Gujarat',
              payment_terms: 'Net 30',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }),
        });
      }
    });

    // Open form
    await page.click('button:has-text("Add Customer")');

    // Fill in required fields
    await page.fill('input#company_name', 'Test Company');
    await page.fill('input#contact', '1234567890');
    await page.fill('input#email', 'test@example.com');
    await page.fill('input#address_line1', '123 Test St');
    await page.fill('input#city', 'Test City');
    await page.fill('input#state', 'Test State');
    await page.fill('input#pincode', '123456');
    await page.fill('input#place_of_supply', '24-Gujarat');
    await page.fill('input#payment_terms', 'Net 30');

    // Submit form
    await page.click('button:has-text("Create Customer")');

    // Verify success (dialog should close)
    await expect(page.locator('text=Add New Customer')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Supplier UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should render supplier list page', async ({ page }) => {
    // Navigate to suppliers page
    await page.goto(`${BASE_URL}/suppliers`);

    // Verify page title
    await expect(page.locator('h1')).toContainText('Suppliers');

    // Verify table headers are present
    await expect(page.locator('th:has-text("Company Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Contact")')).toBeVisible();
    await expect(page.locator('th:has-text("Email")')).toBeVisible();

    // Verify "Add Supplier" button exists
    await expect(page.locator('button:has-text("Add Supplier")')).toBeVisible();

    // Verify search input exists
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should open supplier form dialog when Add Supplier is clicked', async ({ page }) => {
    await page.goto(`${BASE_URL}/suppliers`);

    // Click Add Supplier button
    await page.click('button:has-text("Add Supplier")');

    // Verify dialog opens
    await expect(page.locator('text=Add New Supplier')).toBeVisible();

    // Verify form fields are present
    await expect(page.locator('input#company_name')).toBeVisible();
    await expect(page.locator('input#contact')).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#address_line1')).toBeVisible();
    await expect(page.locator('input#city')).toBeVisible();
    await expect(page.locator('input#state')).toBeVisible();

    // Verify action buttons
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('button:has-text("Create Supplier")')).toBeVisible();
  });

  test('should validate required fields in supplier form', async ({ page }) => {
    await page.goto(`${BASE_URL}/suppliers`);

    // Open form
    await page.click('button:has-text("Add Supplier")');

    // Try to submit empty form
    await page.click('button:has-text("Create Supplier")');

    // Verify validation errors appear
    await expect(page.locator('text=Company name is required')).toBeVisible({ timeout: 3000 });
  });

  test('should submit supplier form successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/suppliers`);

    // Mock API response
    await page.route(`${API_URL}/suppliers`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            supplier: {
              id: 'test-supplier-id',
              company_name: 'Test Supplier Co',
              contact: '9876543210',
              email: 'supplier@example.com',
              address_line1: '456 Supplier Ave',
              city: 'Supplier City',
              state: 'Supplier State',
              pincode: '654321',
              payment_terms: 'Net 45',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }),
        });
      }
    });

    // Open form
    await page.click('button:has-text("Add Supplier")');

    // Fill in required fields
    await page.fill('input#company_name', 'Test Supplier Co');
    await page.fill('input#contact', '9876543210');
    await page.fill('input#email', 'supplier@example.com');
    await page.fill('input#address_line1', '456 Supplier Ave');
    await page.fill('input#city', 'Supplier City');
    await page.fill('input#state', 'Supplier State');
    await page.fill('input#pincode', '654321');
    await page.fill('input#payment_terms', 'Net 45');

    // Submit form
    await page.click('button:has-text("Create Supplier")');

    // Verify success (dialog should close)
    await expect(page.locator('text=Add New Supplier')).not.toBeVisible({ timeout: 5000 });
  });
});
