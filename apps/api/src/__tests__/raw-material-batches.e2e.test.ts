import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Raw Material Batches E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let rawMaterialId: string;
  let createdBatchIds: string[] = [];

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `rmbatchtest${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('rmbatchtestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'RM Batch Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'rmbatchtestadmin123',
      });

    authToken = loginResponse.body.token;

    // Create test raw material
    const rawMaterial = await prisma.rawMaterial.create({
      data: {
        code: `RM-BATCH-TEST-${timestamp}`,
        name: `Test Item for Batches ${timestamp}`,
        category: 'PACKAGING_PRIMARY',
        unit: 'PIECE',
        min_stock_level: 100,
        reorder_point: 50,
        created_by: adminUserId,
      },
    });
    rawMaterialId = rawMaterial.id;
  });

  afterAll(async () => {
    try {
      // Clean up all batches for this raw material (includes untracked ones)
      if (rawMaterialId) {
        await prisma.rawMaterialBatch.deleteMany({
          where: { raw_material_id: rawMaterialId },
        });
        await prisma.rawMaterial.deleteMany({
          where: { id: rawMaterialId },
        });
      }
      // Also clean up tracked batches that might have different raw materials
      await prisma.rawMaterialBatch.deleteMany({
        where: { id: { in: createdBatchIds.filter(Boolean) } },
      });
      await prisma.user.deleteMany({
        where: { id: adminUserId },
      });
    } catch (e) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('POST /api/v1/raw-material-batches - Create Batch', () => {
    it('should create a new raw material batch with all fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/raw-material-batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          raw_material_id: rawMaterialId,
          batch_number: 'RMBATCH-TEST-001',
          receipt_date: '2025-10-01',
          expiry_date: '2026-10-01',
          quantity_received: 1000,
          unit: 'PIECE',
          storage_location: 'Warehouse A',
          quality_parameters: {
            cap_tightness: '15-20 Nm',
            leak_test: 'Pass',
          },
          quality_status: 'APPROVED',
        });

      expect(response.status).toBe(201);
      expect(response.body.batch).toBeDefined();
      expect(response.body.batch.batch_number).toBe('RMBATCH-TEST-001');
      expect(response.body.batch.quantity_received).toBe(1000);
      expect(response.body.batch.quantity_remaining).toBe(1000);
      expect(response.body.batch.quality_status).toBe('APPROVED');
      expect(response.body.batch.quality_parameters).toEqual({
        cap_tightness: '15-20 Nm',
        leak_test: 'Pass',
      });

      createdBatchIds.push(response.body.batch.id);
    });

    it('should create batch with only required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/raw-material-batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          raw_material_id: rawMaterialId,
          batch_number: 'RMBATCH-TEST-002',
          receipt_date: '2025-10-15',
          quantity_received: 500,
          unit: 'PIECE',
        });

      expect(response.status).toBe(201);
      expect(response.body.batch.quality_status).toBe('PENDING');
      expect(response.body.batch.expiry_date).toBeNull();

      createdBatchIds.push(response.body.batch.id);
    });

    it('should reject batch creation without required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/raw-material-batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          batch_number: 'INCOMPLETE-BATCH',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject duplicate batch numbers', async () => {
      const response = await request(API_URL)
        .post('/api/v1/raw-material-batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          raw_material_id: rawMaterialId,
          batch_number: 'RMBATCH-TEST-001', // Duplicate
          receipt_date: '2025-10-01',
          quantity_received: 100,
          unit: 'PIECE',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject batch with non-existent raw material', async () => {
      const response = await request(API_URL)
        .post('/api/v1/raw-material-batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          raw_material_id: '00000000-0000-0000-0000-000000000000',
          batch_number: 'INVALID-RM-BATCH',
          receipt_date: '2025-10-01',
          quantity_received: 100,
          unit: 'PIECE',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Raw material not found');
    });
  });

  describe('GET /api/v1/raw-material-batches - List Batches', () => {
    it('should list all raw material batches', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-material-batches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.rm_batches).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter batches by raw_material_id', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/raw-material-batches?raw_material_id=${rawMaterialId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.rm_batches.forEach((batch: any) => {
        expect(batch.raw_material_id).toBe(rawMaterialId);
      });
    });

    it('should filter batches by quality_status', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-material-batches?quality_status=APPROVED')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.rm_batches.forEach((batch: any) => {
        expect(batch.quality_status).toBe('APPROVED');
      });
    });

    it('should filter batches with stock', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-material-batches?has_stock=true')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.rm_batches.forEach((batch: any) => {
        expect(batch.quantity_remaining).toBeGreaterThan(0);
      });
    });

    it('should support pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-material-batches?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.rm_batches.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should sort batches by created_at desc (newest first)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-material-batches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.rm_batches.length > 1) {
        const firstBatch = new Date(response.body.rm_batches[0].created_at);
        const secondBatch = new Date(response.body.rm_batches[1].created_at);
        expect(firstBatch.getTime()).toBeGreaterThanOrEqual(secondBatch.getTime());
      }
    });
  });

  describe('GET /api/v1/raw-material-batches/:id - Get Batch by ID', () => {
    it('should get batch details by ID', async () => {
      const batchId = createdBatchIds[0];
      const response = await request(API_URL)
        .get(`/api/v1/raw-material-batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.batch).toBeDefined();
      expect(response.body.batch.id).toBe(batchId);
      expect(response.body.batch.raw_material).toBeDefined();
      expect(response.body.batch.consumptions).toBeDefined();
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-material-batches/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/raw-material-batches/:id - Update Batch', () => {
    it('should update batch details', async () => {
      const batchId = createdBatchIds[0];
      const response = await request(API_URL)
        .put(`/api/v1/raw-material-batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storage_location: 'Warehouse B',
          quality_status: 'APPROVED',
          quality_parameters: {
            cap_tightness: '18 Nm',
            leak_test: 'Pass',
            visual_inspection: 'Pass',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.batch.storage_location).toBe('Warehouse B');
      expect(response.body.batch.quality_parameters).toHaveProperty('visual_inspection');
    });

    it('should deactivate a batch', async () => {
      const batchId = createdBatchIds[1];
      const response = await request(API_URL)
        .put(`/api/v1/raw-material-batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_active: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.batch.is_active).toBe(false);

      // Reactivate for other tests
      await request(API_URL)
        .put(`/api/v1/raw-material-batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_active: true,
        });
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await request(API_URL)
        .put('/api/v1/raw-material-batches/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storage_location: 'Test',
        });

      expect(response.status).toBe(404);
    });

    it('should reject duplicate batch number on update', async () => {
      const batchId = createdBatchIds[1];
      const response = await request(API_URL)
        .put(`/api/v1/raw-material-batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          batch_number: 'RMBATCH-TEST-001', // Duplicate with first batch
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('GET /api/v1/raw-material-batches/raw-material/:raw_material_id/available - Get Available Batches', () => {
    it('should get available batches for a raw material (FEFO order)', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/raw-material-batches/raw-material/${rawMaterialId}/available`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.batches).toBeInstanceOf(Array);

      // Should only include approved, active batches with stock
      response.body.batches.forEach((batch: any) => {
        expect(batch.quantity_remaining).toBeGreaterThan(0);
      });

      // Verify FEFO ordering (earliest expiry first)
      if (response.body.batches.length > 1) {
        for (let i = 0; i < response.body.batches.length - 1; i++) {
          const current = response.body.batches[i];
          const next = response.body.batches[i + 1];
          if (current.expiry_date && next.expiry_date) {
            expect(new Date(current.expiry_date).getTime())
              .toBeLessThanOrEqual(new Date(next.expiry_date).getTime());
          }
        }
      }
    });
  });

  describe('PUT /api/v1/raw-material-batches/:id/adjust-stock - Adjust Stock', () => {
    it('should adjust stock downward', async () => {
      const batchId = createdBatchIds[0];

      // Get current quantity
      const getBatch = await request(API_URL)
        .get(`/api/v1/raw-material-batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`);
      const currentQuantity = getBatch.body.batch.quantity_remaining;

      // Adjust stock
      const response = await request(API_URL)
        .put(`/api/v1/raw-material-batches/${batchId}/adjust-stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity_adjustment: -100,
          reason: 'Damaged units removed',
        });

      expect(response.status).toBe(200);
      expect(response.body.adjustment.adjustment).toBe(-100);
      expect(response.body.adjustment.new_quantity).toBe(currentQuantity - 100);
    });

    it('should adjust stock upward after downward adjustment', async () => {
      const batchId = createdBatchIds[0];

      // Get current quantity (should be reduced from previous test)
      const getBatch = await request(API_URL)
        .get(`/api/v1/raw-material-batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`);
      const currentQuantity = getBatch.body.batch.quantity_remaining;

      // Adjust stock upward (but not exceeding original quantity_received)
      const response = await request(API_URL)
        .put(`/api/v1/raw-material-batches/${batchId}/adjust-stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity_adjustment: 50,
          reason: 'Stock correction - found additional units',
        });

      expect(response.status).toBe(200);
      expect(response.body.adjustment.adjustment).toBe(50);
      expect(response.body.adjustment.new_quantity).toBe(currentQuantity + 50);
    });

    it('should reject adjustment resulting in negative quantity', async () => {
      const batchId = createdBatchIds[0];

      const response = await request(API_URL)
        .put(`/api/v1/raw-material-batches/${batchId}/adjust-stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity_adjustment: -10000,
          reason: 'Test negative',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('negative');
    });

    it('should reject adjustment without reason', async () => {
      const batchId = createdBatchIds[0];

      const response = await request(API_URL)
        .put(`/api/v1/raw-material-batches/${batchId}/adjust-stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity_adjustment: 10,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });

  describe('DELETE /api/v1/raw-material-batches/:id - Delete Batch', () => {
    it('should delete a batch without consumptions', async () => {
      // Create a batch to delete
      const createResponse = await request(API_URL)
        .post('/api/v1/raw-material-batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          raw_material_id: rawMaterialId,
          batch_number: 'RMBATCH-TO-DELETE',
          receipt_date: '2025-10-01',
          quantity_received: 10,
          unit: 'PIECE',
        });

      const batchId = createResponse.body.batch.id;
      createdBatchIds.push(batchId);

      // Delete the batch
      const response = await request(API_URL)
        .delete(`/api/v1/raw-material-batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify batch is deleted
      const deletedBatch = await prisma.rawMaterialBatch.findUnique({
        where: { id: batchId },
      });
      expect(deletedBatch).toBeNull();
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await request(API_URL)
        .delete('/api/v1/raw-material-batches/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
