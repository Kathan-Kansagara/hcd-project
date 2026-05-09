import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Batches E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let productId: string;
  let createdBatchIds: string[] = [];

  beforeAll(async () => {
    // Create test admin user
    const adminPassword = await bcrypt.hash('batchtestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'batchtestadmin@zenon.com',
        password_hash: adminPassword,
        name: 'Batch Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: 'batchtestadmin@zenon.com',
        password: 'batchtestadmin123',
      });

    authToken = loginResponse.body.token;

    // Create test product
    const product = await prisma.product.create({
      data: {
        name: 'Batch Test Product',
        description: 'Test Product for Batches',
        category: 'Test Category',
        created_by: adminUserId,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Clean up all created batches
    await prisma.batch.deleteMany({
      where: { id: { in: createdBatchIds } },
    });
    await prisma.product.deleteMany({
      where: { id: productId },
    });
    await prisma.user.deleteMany({
      where: { id: adminUserId },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/batches - Create Batch', () => {
    it('should create a new batch with required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          batch_number: 'BATCH-TEST-001',
          manufacturing_date: '2025-10-01',
          expiry_date: '2026-10-01',
          quantity_produced: 100,
          unit: 'LITER',
        });

      expect(response.status).toBe(201);
      expect(response.body.batch).toBeDefined();
      expect(response.body.batch.batch_number).toBe('BATCH-TEST-001');
      expect(response.body.batch.quantity_produced).toBe(100);
      expect(response.body.batch.quantity_remaining).toBe(100);
      expect(response.body.batch.unit).toBe('LITER');
      expect(response.body.batch.is_active).toBe(true);

      createdBatchIds.push(response.body.batch.id);
    });

    it('should create batch with optional fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          batch_number: 'BATCH-TEST-002',
          manufacturing_date: '2025-10-01',
          expiry_date: '2026-10-01',
          quantity_produced: 50,
          unit: 'KG',
          storage_location: 'Warehouse A',
          notes: 'Test batch with all fields',
        });

      expect(response.status).toBe(201);
      expect(response.body.batch.unit).toBe('KG');
      expect(response.body.batch.storage_location).toBe('Warehouse A');
      expect(response.body.batch.notes).toBe('Test batch with all fields');

      createdBatchIds.push(response.body.batch.id);
    });

    it('should reject batch creation without required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          batch_number: 'BATCH-INCOMPLETE',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject duplicate batch numbers', async () => {
      const response = await request(API_URL)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          batch_number: 'BATCH-TEST-001', // Duplicate
          manufacturing_date: '2025-10-01',
          expiry_date: '2026-10-01',
          quantity_produced: 100,
          unit: 'LITER',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject batch with non-existent product', async () => {
      const response = await request(API_URL)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: '00000000-0000-0000-0000-000000000000',
          batch_number: 'BATCH-INVALID',
          manufacturing_date: '2025-10-01',
          expiry_date: '2026-10-01',
          quantity_produced: 100,
          unit: 'LITER',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Product not found');
    });
  });

  describe('GET /api/v1/batches - List Batches', () => {
    it('should list all batches', async () => {
      const response = await request(API_URL)
        .get('/api/v1/batches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.batches).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter batches by product_id', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/batches?product_id=${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.batches.forEach((batch: any) => {
        expect(batch.product_id).toBe(productId);
      });
    });

    it('should filter batches by is_active', async () => {
      const response = await request(API_URL)
        .get('/api/v1/batches?is_active=true')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.batches.forEach((batch: any) => {
        expect(batch.is_active).toBe(true);
      });
    });

    it('should support pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/batches?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.batches.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should sort batches by created_at desc (newest first)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/batches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.batches.length > 1) {
        const firstBatch = new Date(response.body.batches[0].created_at);
        const secondBatch = new Date(response.body.batches[1].created_at);
        expect(firstBatch.getTime()).toBeGreaterThanOrEqual(secondBatch.getTime());
      }
    });
  });

  describe('GET /api/v1/batches/:id - Get Batch by ID', () => {
    it('should get batch details by ID', async () => {
      const batchId = createdBatchIds[0];
      const response = await request(API_URL)
        .get(`/api/v1/batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.batch).toBeDefined();
      expect(response.body.batch.id).toBe(batchId);
      expect(response.body.batch.product).toBeDefined();
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await request(API_URL)
        .get('/api/v1/batches/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/batches/:id - Update Batch', () => {
    it('should update batch details', async () => {
      const batchId = createdBatchIds[0];
      const response = await request(API_URL)
        .put(`/api/v1/batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storage_location: 'Warehouse B',
          notes: 'Updated batch notes',
        });

      expect(response.status).toBe(200);
      expect(response.body.batch.storage_location).toBe('Warehouse B');
      expect(response.body.batch.notes).toBe('Updated batch notes');
    });

    it('should deactivate a batch', async () => {
      const batchId = createdBatchIds[1];
      const response = await request(API_URL)
        .put(`/api/v1/batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_active: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.batch.is_active).toBe(false);

      // Reactivate for other tests
      await request(API_URL)
        .put(`/api/v1/batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_active: true,
        });
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await request(API_URL)
        .put('/api/v1/batches/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Test',
        });

      expect(response.status).toBe(404);
    });

    it('should reject duplicate batch number on update', async () => {
      const batchId = createdBatchIds[1];
      const response = await request(API_URL)
        .put(`/api/v1/batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          batch_number: 'BATCH-TEST-001', // Duplicate with first batch
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('DELETE /api/v1/batches/:id - Delete Batch', () => {
    it('should delete a batch without applications', async () => {
      // Create a batch to delete
      const createResponse = await request(API_URL)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          batch_number: 'BATCH-TO-DELETE',
          manufacturing_date: '2025-10-01',
          expiry_date: '2026-10-01',
          quantity_produced: 10,
          unit: 'LITER',
        });

      const batchId = createResponse.body.batch.id;
      createdBatchIds.push(batchId);

      // Delete the batch
      const response = await request(API_URL)
        .delete(`/api/v1/batches/${batchId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify batch is deleted
      const deletedBatch = await prisma.batch.findUnique({
        where: { id: batchId },
      });
      expect(deletedBatch).toBeNull();
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await request(API_URL)
        .delete('/api/v1/batches/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/batches/product/:product_id - Get Batches by Product', () => {
    it('should get active batches for a product', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/batches/product/${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.batches).toBeInstanceOf(Array);
      response.body.batches.forEach((batch: any) => {
        expect(batch.id).toBeDefined();
        expect(batch.batch_number).toBeDefined();
        expect(batch.quantity_remaining).toBeGreaterThan(0);
      });
    });

    it('should return empty array for product with no batches', async () => {
      const response = await request(API_URL)
        .get('/api/v1/batches/product/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.batches).toBeInstanceOf(Array);
      expect(response.body.batches.length).toBe(0);
    });
  });
});
