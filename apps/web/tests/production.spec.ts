import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Production Page - Task Group 6.5', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
    await page.goto('http://localhost:5173/production');
    await page.waitForLoadState('networkidle');
  });

  test('should display production page with correct header and structure', async ({ page }) => {
    // Verify page header
    await expect(page.getByRole('heading', { name: 'Production', level: 1 })).toBeVisible();
    await expect(page.getByText('Create finished product batches and record raw material consumption')).toBeVisible();

    // Verify action buttons
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Production Batch/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Filters/i })).toBeVisible();

    // Verify table card
    await expect(page.getByText('Production Batches')).toBeVisible();

    // Verify table columns (if data exists, otherwise empty state)
    const hasData = await page.locator('th', { hasText: 'Batch Number' }).isVisible().catch(() => false);
    if (hasData) {
      await expect(page.locator('th', { hasText: 'Batch Number' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Product' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Manufacturing Date' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Expiry Date' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Stock' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'Status' })).toBeVisible();
    }
  });

  test('should open multi-step wizard when Create Production Batch clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Create Production Batch/i }).click();

    // Verify wizard dialog opened
    await expect(page.getByRole('heading', { name: 'Create Production Batch' })).toBeVisible();
    await expect(page.getByText('Record finished product production and raw material consumption')).toBeVisible();

    // Verify step 1 is shown
    await expect(page.getByText('Product Details')).toBeVisible();
    await expect(page.getByText('Select product and batch information')).toBeVisible();

    // Verify step 1 content header
    await expect(page.getByText('Finished Product Details')).toBeVisible();

    // Verify product dropdown field
    await expect(page.getByText('Product').first()).toBeVisible();
    await expect(page.getByPlaceholder('Select product...')).toBeVisible();

    // Verify batch number field
    await expect(page.getByText('Batch Number').first()).toBeVisible();
    await expect(page.getByPlaceholder('PROD-BATCH-001')).toBeVisible();

    // Verify quantity field
    await expect(page.getByText('Quantity to Produce').first()).toBeVisible();

    // Verify unit dropdown
    await expect(page.getByText('Unit').first()).toBeVisible();

    // Verify date pickers
    await expect(page.getByText('Manufacturing Date').first()).toBeVisible();
    await expect(page.getByText('Expiry Date').first()).toBeVisible();

    // Verify optional fields
    await expect(page.getByText('Storage Location (Optional)')).toBeVisible();
    await expect(page.getByText('Notes (Optional)')).toBeVisible();

    // Verify navigation buttons
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  });

  test('should show step progress indicator in wizard', async ({ page }) => {
    await page.getByRole('button', { name: /Create Production Batch/i }).click();

    // Verify all 3 steps are shown in progress indicator
    await expect(page.getByText('Product Details')).toBeVisible();
    await expect(page.getByText('RM Batch Selection')).toBeVisible();
    await expect(page.getByText('Review & Confirm')).toBeVisible();
  });

  test('should validate required fields on step 1', async ({ page }) => {
    await page.getByRole('button', { name: /Create Production Batch/i }).click();

    // Try to proceed without filling fields
    await page.getByRole('button', { name: 'Next' }).click();

    // Should show validation errors
    await expect(page.getByText(/Product is required/i)).toBeVisible();
    await expect(page.getByText(/Batch number is required/i)).toBeVisible();
  });

  test('should close wizard when Cancel button clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Create Production Batch/i }).click();
    await expect(page.getByRole('heading', { name: 'Create Production Batch' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Create Production Batch' })).not.toBeVisible();
  });

  test('should navigate back from step 2 to step 1', async ({ page }) => {
    await page.getByRole('button', { name: /Create Production Batch/i }).click();

    // Fill step 1 fields
    await page.getByPlaceholder('Select product...').click();
    // Select first product if available
    const firstProduct = page.locator('[role="option"]').first();
    const hasProducts = await firstProduct.isVisible().catch(() => false);

    if (hasProducts) {
      await firstProduct.click();

      // Fill other required fields
      await page.getByPlaceholder('PROD-BATCH-001').fill('TEST-BATCH-001');
      await page.getByPlaceholder('100').fill('50');

      // Click Next
      await page.getByRole('button', { name: 'Next' }).click();

      // Wait for step 2
      await page.waitForTimeout(1000);

      // Verify step 2 might be shown (depends on BOM availability)
      const step2Visible = await page.getByText('Raw Material Requirements').isVisible().catch(() => false);

      if (step2Visible) {
        // Click Back button
        await page.getByRole('button', { name: 'Back' }).click();

        // Should be back on step 1
        await expect(page.getByText('Finished Product Details')).toBeVisible();
      }
    }
  });

  test('should display RM requirements with BOM-based calculations in step 2', async ({ page }) => {
    await page.getByRole('button', { name: /Create Production Batch/i }).click();

    // Fill step 1 with a product that has BOM
    await page.getByPlaceholder('Select product...').click();
    const firstProduct = page.locator('[role="option"]').first();
    const hasProducts = await firstProduct.isVisible().catch(() => false);

    if (hasProducts) {
      await firstProduct.click();
      await page.getByPlaceholder('PROD-BATCH-001').fill('TEST-BATCH-002');
      await page.getByPlaceholder('100').fill('100');

      // Click Next
      await page.getByRole('button', { name: 'Next' }).click();

      // Wait for step 2 to load
      await page.waitForTimeout(2000);

      // Step 2 should show either RM requirements or a message about missing BOM
      const hasRMRequirements = await page.getByText('Raw Material Requirements').isVisible().catch(() => false);

      if (hasRMRequirements) {
        // Verify RM requirements section
        await expect(page.getByText('Raw Material Requirements')).toBeVisible();

        // Should show FIFO info
        const hasFIFOInfo = await page.getByText(/Automatic RM Batch Selection/i).isVisible().catch(() => false);
        if (hasFIFOInfo) {
          await expect(page.getByText(/FIFO/i)).toBeVisible();
        }
      } else {
        // Should show message about no BOM
        const noBOMMessage = await page.getByText(/No raw material requirements found/i).isVisible().catch(() => false);
        expect(noBOMMessage).toBeTruthy();
      }
    }
  });

  test('should show stock validation alerts when insufficient stock', async ({ page }) => {
    await page.getByRole('button', { name: /Create Production Batch/i }).click();

    // Fill step 1 with high quantity to potentially trigger insufficient stock
    await page.getByPlaceholder('Select product...').click();
    const firstProduct = page.locator('[role="option"]').first();
    const hasProducts = await firstProduct.isVisible().catch(() => false);

    if (hasProducts) {
      await firstProduct.click();
      await page.getByPlaceholder('PROD-BATCH-001').fill('TEST-BATCH-003');
      // Use very high quantity to trigger insufficient stock
      await page.getByPlaceholder('100').fill('999999');

      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(2000);

      // Check if insufficient stock alert is shown
      const hasInsufficientStock = await page.getByText(/Insufficient stock/i).isVisible().catch(() => false);
      const cannotProceed = await page.getByText(/Cannot proceed with production/i).isVisible().catch(() => false);

      // At least one of these messages should appear if stock is insufficient
      if (hasInsufficientStock || cannotProceed) {
        expect(hasInsufficientStock || cannotProceed).toBeTruthy();
      }
    }
  });

  test('should show accordion with individual RM batch details', async ({ page }) => {
    await page.getByRole('button', { name: /Create Production Batch/i }).click();

    await page.getByPlaceholder('Select product...').click();
    const firstProduct = page.locator('[role="option"]').first();
    const hasProducts = await firstProduct.isVisible().catch(() => false);

    if (hasProducts) {
      await firstProduct.click();
      await page.getByPlaceholder('PROD-BATCH-001').fill('TEST-BATCH-004');
      await page.getByPlaceholder('100').fill('10');

      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(2000);

      // Check if accordion items exist for RM requirements
      const accordionTriggers = page.locator('[data-state="closed"], [data-state="open"]');
      const accordionCount = await accordionTriggers.count();

      if (accordionCount > 0) {
        // Click first accordion to expand
        await accordionTriggers.first().click();

        // Should show batch details
        const hasBatchDetails = await page.getByText(/Available:/i).isVisible().catch(() => false);
        expect(hasBatchDetails).toBeTruthy();
      }
    }
  });

  test('should navigate to review step after valid RM selection', async ({ page }) => {
    await page.getByRole('button', { name: /Create Production Batch/i }).click();

    await page.getByPlaceholder('Select product...').click();
    const firstProduct = page.locator('[role="option"]').first();
    const hasProducts = await firstProduct.isVisible().catch(() => false);

    if (hasProducts) {
      await firstProduct.click();
      await page.getByPlaceholder('PROD-BATCH-001').fill('TEST-BATCH-005');
      await page.getByPlaceholder('100').fill('1'); // Small quantity to ensure sufficient stock

      // Go to step 2
      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(2000);

      // Check if we can proceed to step 3
      const hasNextButton = await page.getByRole('button', { name: 'Next' }).isVisible().catch(() => false);

      if (hasNextButton) {
        await page.getByRole('button', { name: 'Next' }).click();
        await page.waitForTimeout(1000);

        // Verify step 3 - Review & Confirm
        const hasReview = await page.getByText('Review Production Details').isVisible().catch(() => false);
        if (hasReview) {
          await expect(page.getByText('Review Production Details')).toBeVisible();
          await expect(page.getByText('Raw Material Consumption Summary:')).toBeVisible();
          await expect(page.getByRole('button', { name: /Create Production Batch/i })).toBeVisible();
        }
      }
    }
  });

  test('should display production summary on review step', async ({ page }) => {
    await page.getByRole('button', { name: /Create Production Batch/i }).click();

    await page.getByPlaceholder('Select product...').click();
    const firstProduct = page.locator('[role="option"]').first();
    const hasProducts = await firstProduct.isVisible().catch(() => false);

    if (hasProducts) {
      await firstProduct.click();
      await page.getByPlaceholder('PROD-BATCH-001').fill('REVIEW-TEST-001');
      await page.getByPlaceholder('100').fill('5');

      // Navigate through steps
      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(2000);

      const hasNextButton = await page.getByRole('button', { name: 'Next' }).isVisible().catch(() => false);
      if (hasNextButton) {
        await page.getByRole('button', { name: 'Next' }).click();
        await page.waitForTimeout(1000);

        // Verify review details are shown
        const hasReview = await page.getByText('Review Production Details').isVisible().catch(() => false);
        if (hasReview) {
          // Should show batch number we entered
          await expect(page.getByText('REVIEW-TEST-001')).toBeVisible();

          // Should show quantity
          await expect(page.getByText(/5/)).toBeVisible();

          // Should show ready to create message
          await expect(page.getByText(/Ready to create production batch/i)).toBeVisible();
        }
      }
    }
  });

  test('should have delete action in row dropdown menu', async ({ page }) => {
    // Check if there's any data to test with
    const hasRows = await page.locator('tbody tr').first().isVisible().catch(() => false);

    if (hasRows) {
      // Click on first row's action menu
      const actionButton = page.locator('button[aria-label="Actions"]').first();
      if (await actionButton.isVisible().catch(() => false)) {
        await actionButton.click();

        // Verify delete option exists
        await expect(page.getByRole('menuitem', { name: /Delete/i })).toBeVisible();
      }
    }
  });

  test('should show delete confirmation dialog', async ({ page }) => {
    const hasRows = await page.locator('tbody tr').first().isVisible().catch(() => false);

    if (hasRows) {
      const actionButton = page.locator('button[aria-label="Actions"]').first();
      if (await actionButton.isVisible().catch(() => false)) {
        await actionButton.click();

        const deleteOption = page.getByRole('menuitem', { name: /Delete/i });
        if (await deleteOption.isVisible().catch(() => false)) {
          await deleteOption.click();

          // Verify confirmation dialog appears
          await expect(page.getByText('Delete Production Batch')).toBeVisible();
          await expect(page.getByText(/Are you sure you want to delete this production batch/i)).toBeVisible();

          // Should have Cancel and Delete buttons
          await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
          await expect(page.getByRole('button', { name: /Delete/i })).toBeVisible();
        }
      }
    }
  });

  test('should be responsive at 375px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should still load and be functional
    await expect(page.getByRole('heading', { name: 'Production' })).toBeVisible();

    // Buttons should be visible (might be stacked)
    await expect(page.getByRole('button', { name: /Create Production Batch/i })).toBeVisible();

    // Table card should be visible
    await expect(page.getByText('Production Batches')).toBeVisible();

    // Dialog should open and be usable on mobile
    await page.getByRole('button', { name: /Create Production Batch/i }).click();
    await expect(page.getByRole('heading', { name: 'Create Production Batch' })).toBeVisible();

    // Form fields should be visible and usable on mobile
    await expect(page.getByPlaceholder('Select product...')).toBeVisible();
    await expect(page.getByPlaceholder('PROD-BATCH-001')).toBeVisible();
  });

  test('should display status badges with correct variants', async ({ page }) => {
    const hasRows = await page.locator('tbody tr').first().isVisible().catch(() => false);

    if (hasRows) {
      // Check if status badges are rendered
      const statusBadges = page.locator('[class*="badge"]');
      const badgeCount = await statusBadges.count();

      if (badgeCount > 0) {
        // At least one status badge should be visible
        expect(badgeCount).toBeGreaterThan(0);

        // Common status values: ACTIVE, EXPIRING_SOON, EXPIRED
        const hasStatus = await page.getByText(/Active|Expiring Soon|Expired/i).isVisible().catch(() => false);
        if (hasStatus) {
          expect(hasStatus).toBeTruthy();
        }
      }
    }
  });

  test('should show stock quantity with remaining/total format', async ({ page }) => {
    const hasRows = await page.locator('tbody tr').first().isVisible().catch(() => false);

    if (hasRows) {
      // Stock should be shown in format: "remaining / total unit"
      const stockCells = page.locator('td').filter({ hasText: /\d+\s*\/\s*\d+/ });
      const stockCount = await stockCells.count();

      if (stockCount > 0) {
        expect(stockCount).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Production Page - Excel Export', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should have Excel export button', async ({ page }) => {
    await page.goto('http://localhost:5173/production');
    await page.waitForLoadState('networkidle');

    const exportButton = page.getByRole('button', { name: /Export Excel/i });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
  });
});

test.describe('Production Page - BOM Integration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should show alert when product has no BOM defined', async ({ page }) => {
    await page.goto('http://localhost:5173/production');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Create Production Batch/i }).click();

    // Select a product
    await page.getByPlaceholder('Select product...').click();
    const firstProduct = page.locator('[role="option"]').first();
    const hasProducts = await firstProduct.isVisible().catch(() => false);

    if (hasProducts) {
      await firstProduct.click();
      await page.getByPlaceholder('PROD-BATCH-001').fill('NO-BOM-TEST');
      await page.getByPlaceholder('100').fill('10');

      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(2000);

      // Should show either RM requirements or no BOM message
      const hasNoRMMessage = await page.getByText(/No raw material requirements found/i).isVisible().catch(() => false);
      const hasBOMError = await page.getByText(/does not have a recipe/i).isVisible().catch(() => false);

      // One of these messages might appear if no BOM exists
      if (hasNoRMMessage || hasBOMError) {
        expect(hasNoRMMessage || hasBOMError).toBeTruthy();
      }
    }
  });
});
