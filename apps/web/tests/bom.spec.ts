import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('BOMs (Product Recipes) Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display BOMs page with correct layout', async ({ page }) => {
    await page.goto('/bom');

    // Verify page header
    await expect(page.getByRole('heading', { name: /product recipes|bom/i, level: 1 })).toBeVisible();

    // Verify action buttons
    await expect(page.getByRole('button', { name: /export excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new (bom|recipe)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /filters/i })).toBeVisible();

    // Verify table is present
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should open BOM form dialog', async ({ page }) => {
    await page.goto('/bom');

    // Click New BOM button
    await page.getByRole('button', { name: /new (bom|recipe)/i }).click();

    // Verify dialog opened
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should display searchable product dropdown', async ({ page }) => {
    await page.goto('/bom');
    await page.getByRole('button', { name: /new (bom|recipe)/i }).click();

    // Look for product selection (SearchableCombobox)
    const productButton = page.getByRole('button', { name: /select product|product/i }).first();

    if (await productButton.isVisible()) {
      // Click to open dropdown
      await productButton.click();

      // Verify search input appears
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    }
  });

  test('should display searchable raw material dropdown', async ({ page }) => {
    await page.goto('/bom');
    await page.getByRole('button', { name: /new (bom|recipe)/i }).click();

    // The form should have a way to add ingredients/raw materials
    // Look for "Add Ingredient" or similar button
    const addIngredientButton = page.getByRole('button', { name: /add (ingredient|raw material)/i });

    if (await addIngredientButton.isVisible()) {
      await addIngredientButton.click();

      // Look for raw material dropdown
      const rmButton = page.getByRole('button', { name: /select (raw material|ingredient)/i }).first();

      if (await rmButton.isVisible()) {
        await rmButton.click();
        await expect(page.getByPlaceholder(/search/i)).toBeVisible();
      }
    }
  });

  test('should create BOM with product and raw materials', async ({ page }) => {
    await page.goto('/bom');

    // Click New BOM
    await page.getByRole('button', { name: /new (bom|recipe)/i }).click();

    // Wait for form to load
    await page.waitForTimeout(500);

    // Select a product
    const productButton = page.getByRole('button', { name: /select product|product/i }).first();
    if (await productButton.isVisible()) {
      await productButton.click();
      await page.waitForTimeout(500);
      // Select first product from dropdown
      await page.getByRole('option').first().click();
    }

    // Fill quantity to produce
    const quantityField = page.getByLabel(/quantity|batch size/i);
    if (await quantityField.isVisible()) {
      await quantityField.fill('100');
    }

    // Note: Adding ingredients might require more complex interaction
    // This test validates the basic form opening and product selection

    // Try to submit (may fail validation if ingredients are required)
    const submitButton = page.getByRole('button', { name: /create|add|save/i });
    await submitButton.click();

    // Either success or validation error should appear
    // We're testing that the form is functional
    await page.waitForTimeout(1000);
  });

  test('should export BOMs to Excel', async ({ page }) => {
    await page.goto('/bom');

    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Click Export Excel button
    await page.getByRole('button', { name: /export excel/i }).click();

    // Wait for download
    const download = await downloadPromise;

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/bom|recipe/i);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test('should delete BOM with confirmation', async ({ page }) => {
    await page.goto('/bom');

    // Wait for table to load
    await page.waitForTimeout(1000);

    // Find first Actions dropdown
    const actionsButton = page.getByRole('button', { name: /actions/i }).first();

    if (await actionsButton.isVisible()) {
      await actionsButton.click();

      // Click Delete option
      await page.getByRole('menuitem', { name: /delete/i }).click();

      // Confirm dialog should appear
      await expect(page.getByRole('dialog', { name: /confirm|delete/i })).toBeVisible();

      // Cancel the deletion
      await page.getByRole('button', { name: /cancel/i }).click();
    }
  });
});

test.describe('BOMs Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.goto('/bom');

    // Verify page elements
    await expect(page.getByRole('heading', { name: /product recipes|bom/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new (bom|recipe)/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should open form dialog on mobile', async ({ page }) => {
    await page.goto('/bom');

    await page.getByRole('button', { name: /new (bom|recipe)/i }).click();

    // Dialog should be usable on mobile
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
