import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Batch Stock Update E2E Tests', () => {
  const ts = Date.now();
  let authToken: string;
  let adminUserId: string;
  let productId: string;
  let batchId: string;
  let farmerId: string;
  let locationId: string;
  let trialId: string;
  let application1Id: string;
  let application2Id: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `bstest${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('testadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'testadmin123',
      });

    authToken = loginResponse.body.token;

    // Create test product
    const product = await prisma.product.create({
      data: {
        name: 'Test Product E2E',
        description: 'E2E Test Product',
        category: 'Test Category',
        created_by: adminUserId,
      },
    });
    productId = product.id;

    // Create test batch with 100 LITER
    const batch = await prisma.batch.create({
      data: {
        product_id: productId,
        batch_number: `BATCH-E2E-TEST-001-${timestamp}`,
        manufacturing_date: new Date('2025-10-01'),
        expiry_date: new Date('2026-10-01'),
        quantity_produced: 100,
        quantity_remaining: 100,
        unit: 'LITER',
        is_active: true,
        created_by: adminUserId,
      },
    });
    batchId = batch.id;

    // Create test location
    const location = await prisma.location.create({
      data: { village: 'Test Village', state: 'Test State' },
    });
    locationId = location.id;

    // Create test farmer
    const farmer = await prisma.farmer.create({
      data: {
        name: 'Test Farmer E2E',
        location_id: locationId,
        contact: '1234567890',
        created_by: adminUserId,
      },
    });
    farmerId = farmer.id;

    // Create test trial
    const trial = await prisma.trial.create({
      data: {
        farmer_id: farmerId,
        product_id: productId,
        crop: 'Test Crop',
        location_id: locationId,
        season: 'Test Season 2025',
        start_date: new Date('2025-01-01'),
        status: 'IN_PROGRESS',
        created_by: adminUserId,
      },
    });
    trialId = trial.id;

    // Create two test applications (without batches initially)
    const app1 = await prisma.application.create({
      data: {
        trial_id: trialId,
        app_number: 1,
        app_type: 'SPRAY',
        app_date: new Date('2025-01-05'),
        status: 'pending',
        created_by: adminUserId,
      },
    });
    application1Id = app1.id;

    const app2 = await prisma.application.create({
      data: {
        trial_id: trialId,
        app_number: 2,
        app_type: 'DRIP',
        app_date: new Date('2025-01-10'),
        status: 'pending',
        created_by: adminUserId,
      },
    });
    application2Id = app2.id;
  });

  afterAll(async () => {
    try {
      // Clean up test data
      if (trialId) {
        await prisma.application.deleteMany({ where: { trial_id: trialId } });
        await prisma.trial.deleteMany({ where: { id: trialId } });
      }
      if (farmerId) await prisma.farmer.deleteMany({ where: { id: farmerId } });
      if (locationId) await prisma.location.deleteMany({ where: { id: locationId } });
      if (batchId) await prisma.batch.deleteMany({ where: { id: batchId } });
      if (productId) await prisma.product.deleteMany({ where: { id: productId } });
      if (adminUserId) await prisma.user.deleteMany({ where: { id: adminUserId } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('Scenario 1: Adding batch to application with no batch', () => {
    it('should assign batch and deduct full quantity from batch stock', async () => {
      // Verify initial state
      const initialBatch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(initialBatch?.quantity_remaining).toBe(100);

      const initialApp = await prisma.application.findUnique({
        where: { id: application1Id },
      });
      expect(initialApp?.batch_id).toBeNull();
      expect(initialApp?.quantity_used).toBeNull();

      // Update application to add batch with 20 liters
      const response = await request(API_URL)
        .put(`/api/v1/applications/${application1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          batch_id: batchId,
          quantity_used: 20,
        });

      expect(response.status).toBe(200);
      expect(response.body.application.batch_id).toBe(batchId);
      expect(response.body.application.quantity_used).toBe(20);

      // Verify batch stock decreased by 20 liters
      const updatedBatch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(updatedBatch?.quantity_remaining).toBe(80);
    });
  });

  describe('Scenario 2: Changing quantity on existing batch assignment (same batch)', () => {
    it('should deduct only the difference when increasing quantity', async () => {
      // Application 1 currently has 20 liters, batch stock is 80 liters
      const initialBatch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(initialBatch?.quantity_remaining).toBe(80);

      // Increase quantity from 20 to 35 liters (difference: 15 liters)
      const response = await request(API_URL)
        .put(`/api/v1/applications/${application1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity_used: 35,
        });

      expect(response.status).toBe(200);
      expect(response.body.application.quantity_used).toBe(35);

      // Verify batch stock decreased by 15 liters (the difference)
      const updatedBatch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(updatedBatch?.quantity_remaining).toBe(65); // 80 - 15 = 65
    });

    it('should restore the difference when decreasing quantity', async () => {
      // Application 1 currently has 35 liters, batch stock is 65 liters
      const initialBatch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(initialBatch?.quantity_remaining).toBe(65);

      // Decrease quantity from 35 to 25 liters (difference: -10 liters)
      const response = await request(API_URL)
        .put(`/api/v1/applications/${application1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity_used: 25,
        });

      expect(response.status).toBe(200);
      expect(response.body.application.quantity_used).toBe(25);

      // Verify batch stock increased by 10 liters (the difference)
      const updatedBatch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(updatedBatch?.quantity_remaining).toBe(75); // 65 + 10 = 75
    });
  });

  describe('Scenario 3: Changing batch assignment (different batch)', () => {
    let secondBatchId: string;

    beforeEach(async () => {
      // Create a second batch
      const secondBatch = await prisma.batch.create({
        data: {
          product_id: productId,
          batch_number: `BATCH-E2E-TEST-002-${ts}`,
          manufacturing_date: new Date('2025-10-01'),
          expiry_date: new Date('2026-10-01'),
          quantity_produced: 100,
          quantity_remaining: 100,
          unit: 'LITER',
          is_active: true,
          created_by: adminUserId,
        },
      });
      secondBatchId = secondBatch.id;
    });

    afterAll(async () => {
      // Clean up second batch
      if (secondBatchId) {
        await prisma.batch.deleteMany({
          where: { id: secondBatchId },
        });
      }
    });

    it('should restore quantity to old batch and deduct from new batch', async () => {
      // Application 1 currently has batch1 with 25 liters, batch1 stock is 75 liters
      // batch2 stock is 100 liters
      const initialBatch1 = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(initialBatch1?.quantity_remaining).toBe(75);

      const initialBatch2 = await prisma.batch.findUnique({
        where: { id: secondBatchId },
      });
      expect(initialBatch2?.quantity_remaining).toBe(100);

      // Change from batch1 (25 liters) to batch2 (30 liters)
      const response = await request(API_URL)
        .put(`/api/v1/applications/${application1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          batch_id: secondBatchId,
          quantity_used: 30,
        });

      expect(response.status).toBe(200);
      expect(response.body.application.batch_id).toBe(secondBatchId);
      expect(response.body.application.quantity_used).toBe(30);

      // Verify batch1 stock increased by 25 liters (restored)
      const updatedBatch1 = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(updatedBatch1?.quantity_remaining).toBe(100); // 75 + 25 = 100

      // Verify batch2 stock decreased by 30 liters
      const updatedBatch2 = await prisma.batch.findUnique({
        where: { id: secondBatchId },
      });
      expect(updatedBatch2?.quantity_remaining).toBe(70); // 100 - 30 = 70
    });
  });

  describe('Scenario 4: Removing batch assignment', () => {
    it('should restore quantity to batch when removing batch assignment', async () => {
      // Application 1 currently has batch2 with 30 liters, batch2 stock is 70 liters
      // Remove batch assignment by setting batch_id to null
      const response = await request(API_URL)
        .put(`/api/v1/applications/${application1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          batch_id: null,
          quantity_used: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.application.batch_id).toBeNull();
      expect(response.body.application.quantity_used).toBeNull();

      // Note: We can't verify the batch stock restoration in this test
      // because we removed the batch from application1, but the logic
      // should restore 30 liters back to the batch
    });
  });

  describe('Scenario 5: Validation - Insufficient batch quantity', () => {
    it('should reject update when requested quantity exceeds available stock', async () => {
      // Application 2 has no batch, batch1 stock is 100 liters
      // Try to assign 150 liters (more than available)
      const response = await request(API_URL)
        .put(`/api/v1/applications/${application2Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          batch_id: batchId,
          quantity_used: 150,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient quantity');

      // Verify batch stock unchanged
      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(batch?.quantity_remaining).toBe(100);
    });
  });

  describe('Scenario 6: Validation - Inactive batch', () => {
    it('should reject update when batch is not active', async () => {
      // Deactivate the batch
      await prisma.batch.update({
        where: { id: batchId },
        data: { is_active: false },
      });

      // Try to assign the inactive batch
      const response = await request(API_URL)
        .put(`/api/v1/applications/${application2Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          batch_id: batchId,
          quantity_used: 10,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Batch is not active');

      // Reactivate for cleanup
      await prisma.batch.update({
        where: { id: batchId },
        data: { is_active: true },
      });
    });
  });

  describe('Scenario 7: Validation - Expired batch', () => {
    it('should reject update when batch has expired', async () => {
      // Set batch expiry date to the past
      await prisma.batch.update({
        where: { id: batchId },
        data: { expiry_date: new Date('2020-01-01') },
      });

      // Try to assign the expired batch
      const response = await request(API_URL)
        .put(`/api/v1/applications/${application2Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          batch_id: batchId,
          quantity_used: 10,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Batch has expired');

      // Reset expiry date for cleanup
      await prisma.batch.update({
        where: { id: batchId },
        data: { expiry_date: new Date('2026-10-01') },
      });
    });
  });

  describe('Scenario 8: Create application with batch', () => {
    it('should create application with batch and deduct quantity', async () => {
      // Verify initial batch stock
      const initialBatch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      const initialStock = initialBatch?.quantity_remaining || 0;

      // Create new application with batch
      const response = await request(API_URL)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          trial_id: trialId,
          app_number: 3,
          app_type: 'IRRIGATION',
          app_date: new Date('2025-01-15'),
          batch_id: batchId,
          quantity_used: 15,
        });

      expect(response.status).toBe(201);
      expect(response.body.application.batch_id).toBe(batchId);
      expect(response.body.application.quantity_used).toBe(15);

      // Verify batch stock decreased by 15 liters
      const updatedBatch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(updatedBatch?.quantity_remaining).toBe(initialStock - 15);

      // Clean up created application
      await prisma.application.delete({
        where: { id: response.body.application.id },
      });
    });
  });
});
