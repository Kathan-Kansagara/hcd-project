# E2E Tests for Batch Stock Update

## Overview

This directory contains comprehensive end-to-end tests for the batch stock update functionality in the Zenon CropTrial API.

## Test Coverage

The `batch-stock-update.e2e.test.ts` file covers **8 critical scenarios**:

### ✅ Scenario 1: Adding Batch to Application with No Batch
- Tests assigning a batch to an application that has no batch
- Verifies the full quantity is deducted from batch stock

### ✅ Scenario 2: Changing Quantity on Existing Batch (Same Batch)
- **Increasing Quantity**: Tests that only the difference is deducted
- **Decreasing Quantity**: Tests that the difference is restored to the batch

### ✅ Scenario 3: Changing Batch Assignment (Different Batch)
- Tests switching from one batch to another
- Verifies old batch stock is restored and new batch stock is deducted

### ✅ Scenario 4: Removing Batch Assignment
- Tests removing batch assignment by setting batch_id to null
- Verifies quantity is restored to the original batch

### ✅ Scenario 5: Validation - Insufficient Batch Quantity
- Tests that requests for more quantity than available are rejected
- Verifies batch stock remains unchanged

### ✅ Scenario 6: Validation - Inactive Batch
- Tests that inactive batches cannot be assigned
- Verifies appropriate error message is returned

### ✅ Scenario 7: Validation - Expired Batch
- Tests that expired batches cannot be assigned
- Verifies appropriate error message is returned

### ✅ Scenario 8: Create Application with Batch
- Tests creating a new application with batch assignment
- Verifies batch stock is correctly deducted during creation

## Running the Tests

### Prerequisites

1. Ensure the API server is running:
   ```bash
   pnpm --filter @zenon/api dev
   ```

2. Ensure the database is accessible and migrations are up to date

### Run All Tests

```bash
pnpm --filter @zenon/api test
```

### Run Tests in Watch Mode

```bash
pnpm --filter @zenon/api test:watch
```

### Run Tests with UI

```bash
pnpm --filter @zenon/api test:ui
```

### Run Tests with Coverage

```bash
pnpm --filter @zenon/api test:coverage
```

## Test Structure

Each test:
1. **Setup**: Creates test data (users, products, batches, farmers, trials, applications)
2. **Execution**: Makes API calls to update applications
3. **Verification**: Checks both API responses and database state
4. **Cleanup**: Removes all test data after completion

## Key Features

- ✅ **Isolated Test Data**: Each test run creates its own test data
- ✅ **Database Verification**: Tests verify both API responses and actual database state
- ✅ **Comprehensive Coverage**: Tests both success and error scenarios
- ✅ **Transaction Safety**: Tests verify atomic operations
- ✅ **Realistic Scenarios**: Tests mirror real-world use cases

## Test Data

The tests use the following test data:
- **Product**: "Test Product E2E"
- **Batch**: "BATCH-E2E-TEST-001" with 100 LITER initial stock
- **Farmer**: "Test Farmer E2E"
- **Trial**: Test trial with 2 applications
- **User**: "testadmin@zenon.com" with ADMIN role

## Debugging Tests

To debug a specific test:

```bash
# Run a specific test file
pnpm vitest run batch-stock-update.e2e.test.ts

# Run with verbose output
pnpm vitest run --reporter=verbose

# Run a specific test suite
pnpm vitest run -t "Scenario 2"
```

## Troubleshooting

### Tests Failing

1. **Check API Server**: Ensure the API server is running on `http://localhost:3000`
2. **Check Database**: Verify database is accessible and migrations are current
3. **Check Permissions**: Ensure test user has proper permissions
4. **Check Logs**: Review API server logs for errors

### Database Issues

If tests leave orphaned data:

```bash
# Reset the database
pnpm --filter @zenon/database db:reset

# Re-run migrations
pnpm --filter @zenon/database migrate:dev
```

## Contributing

When adding new batch-related functionality:

1. Add corresponding E2E tests to this file
2. Follow the existing test structure
3. Ensure tests clean up after themselves
4. Run all tests before committing

## Test Results

All 9 tests should pass:
- ✅ Adding batch to application with no batch
- ✅ Increasing quantity (same batch)
- ✅ Decreasing quantity (same batch)
- ✅ Changing batch assignment
- ✅ Removing batch assignment
- ✅ Insufficient quantity validation
- ✅ Inactive batch validation
- ✅ Expired batch validation
- ✅ Create application with batch
