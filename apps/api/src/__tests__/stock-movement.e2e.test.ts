import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Stock Movements E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let rawMaterialId: string;
  let rawMaterialId2: string;
  let batchId: string;
  let batchId2: string;
  let stockMovementIds: string[] = [];

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `stockmovtest${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('stockmovtestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'Stock Movement Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'stockmovtestadmin123',
      });

    authToken = loginResponse.body.token;

    // Create test raw materials
    const rawMaterial1 = await prisma.rawMaterial.create({
      data: {
        code: `RM-SM-TEST-1-${timestamp}`,
        name: `Test RM for Stock Mov 1 ${timestamp}`,
        category: 'PACKAGING_PRIMARY',
        unit: 'PIECE',
        min_stock_level: 100,
        reorder_point: 50,
        created_by: adminUserId,
      },
    });
    rawMaterialId = rawMaterial1.id;

    const rawMaterial2 = await prisma.rawMaterial.create({
      data: {
        code: `RM-SM-TEST-2-${timestamp}`,
        name: `Test RM for Stock Mov 2 ${timestamp}`,
        category: 'PACKAGING_PRIMARY',
        unit: 'KG',
        min_stock_level: 50,
        reorder_point: 25,
        created_by: adminUserId,
      },
    });
    rawMaterialId2 = rawMaterial2.id;

    // Create test raw material batches
    const batch1 = await prisma.rawMaterialBatch.create({
      data: {
        raw_material_id: rawMaterialId,
        batch_number: `SM-BATCH-1-${timestamp}`,
        receipt_date: new Date('2025-01-01'),
        quantity_received: 1000,
        quantity_remaining: 800,
        unit: 'PIECE',
        quality_status: 'APPROVED',
        created_by: adminUserId,
      },
    });
    batchId = batch1.id;

    const batch2 = await prisma.rawMaterialBatch.create({
      data: {
        raw_material_id: rawMaterialId2,
        batch_number: `SM-BATCH-2-${timestamp}`,
        receipt_date: new Date('2025-01-15'),
        quantity_received: 500,
        quantity_remaining: 400,
        unit: 'KG',
        quality_status: 'APPROVED',
        created_by: adminUserId,
      },
    });
    batchId2 = batch2.id;

    // Create stock movements with different types and dates
    const movement1 = await prisma.stockMovement.create({
      data: {
        movement_type: 'PURCHASE',
        raw_material_id: rawMaterialId,
        batch_id: batchId,
        quantity: 200,
        unit: 'PIECE',
        reference_type: 'PurchaseOrder',
        reference_id: `po-test-${timestamp}`,
        movement_date: new Date('2025-02-01'),
        created_by: adminUserId,
      },
    });
    stockMovementIds.push(movement1.id);

    const movement2 = await prisma.stockMovement.create({
      data: {
        movement_type: 'SALE',
        raw_material_id: rawMaterialId,
        batch_id: batchId,
        quantity: -50,
        unit: 'PIECE',
        reference_type: 'SalesOrder',
        reference_id: `so-test-${timestamp}`,
        movement_date: new Date('2025-02-05'),
        created_by: adminUserId,
      },
    });
    stockMovementIds.push(movement2.id);

    const movement3 = await prisma.stockMovement.create({
      data: {
        movement_type: 'ADJUSTMENT',
        raw_material_id: rawMaterialId,
        batch_id: batchId,
        quantity: -10,
        unit: 'PIECE',
        reference_type: 'Adjustment',
        reference_id: `adj-test-${timestamp}`,
        movement_date: new Date('2025-02-10'),
        created_by: adminUserId,
      },
    });
    stockMovementIds.push(movement3.id);

    const movement4 = await prisma.stockMovement.create({
      data: {
        movement_type: 'PURCHASE',
        raw_material_id: rawMaterialId2,
        batch_id: batchId2,
        quantity: 100,
        unit: 'KG',
        reference_type: 'PurchaseOrder',
        reference_id: `po-test-2-${timestamp}`,
        movement_date: new Date('2025-02-15'),
        created_by: adminUserId,
      },
    });
    stockMovementIds.push(movement4.id);
  });

  afterAll(async () => {
    try {
      if (stockMovementIds.length > 0) {
        await prisma.stockMovement.deleteMany({
          where: { id: { in: stockMovementIds } },
        });
      }
      if (batchId) {
        await prisma.rawMaterialBatch.deleteMany({ where: { id: batchId } });
      }
      if (batchId2) {
        await prisma.rawMaterialBatch.deleteMany({ where: { id: batchId2 } });
      }
      if (rawMaterialId) {
        await prisma.rawMaterial.deleteMany({ where: { id: rawMaterialId } });
      }
      if (rawMaterialId2) {
        await prisma.rawMaterial.deleteMany({ where: { id: rawMaterialId2 } });
      }
      if (adminUserId) {
        await prisma.user.deleteMany({ where: { id: adminUserId } });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('Auth required', () => {
    it('should return 401 without token', async () => {
      const response = await request(API_URL).get('/api/v1/stock-movements');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/stock-movements - List with pagination', () => {
    it('should list stock movements with pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/stock-movements')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stock_movements).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(4);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
      expect(response.body.pagination.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('should support pagination with page and limit', async () => {
      const response = await request(API_URL)
        .get('/api/v1/stock-movements?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stock_movements.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.page).toBe(1);
    });
  });

  describe('GET /api/v1/stock-movements - Filter by raw_material_id', () => {
    it('should filter movements by raw_material_id', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/stock-movements?raw_material_id=${rawMaterialId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.stock_movements.forEach((mov: { raw_material_id: string }) => {
        expect(mov.raw_material_id).toBe(rawMaterialId);
      });
      expect(response.body.stock_movements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GET /api/v1/stock-movements - Filter by movement_type', () => {
    it('should filter movements by movement_type', async () => {
      const response = await request(API_URL)
        .get('/api/v1/stock-movements?movement_type=PURCHASE')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.stock_movements.forEach((mov: { movement_type: string }) => {
        expect(mov.movement_type).toBe('PURCHASE');
      });
    });
  });

  describe('GET /api/v1/stock-movements - Filter by date range', () => {
    it('should filter movements by from_date and to_date', async () => {
      const response = await request(API_URL)
        .get('/api/v1/stock-movements?from_date=2025-02-01&to_date=2025-02-10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.stock_movements.forEach((mov: { movement_date: string }) => {
        const date = new Date(mov.movement_date);
        expect(date.getTime()).toBeGreaterThanOrEqual(new Date('2025-02-01').getTime());
        expect(date.getTime()).toBeLessThanOrEqual(new Date('2025-02-10').getTime());
      });
    });
  });

  describe('GET /api/v1/stock-movements/:id - Get by ID', () => {
    it('should get stock movement by ID', async () => {
      const movementId = stockMovementIds[0];
      const response = await request(API_URL)
        .get(`/api/v1/stock-movements/${movementId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stock_movement).toBeDefined();
      expect(response.body.stock_movement.id).toBe(movementId);
      expect(response.body.stock_movement.raw_material).toBeDefined();
      expect(response.body.stock_movement.raw_material.code).toBeDefined();
      expect(response.body.stock_movement.raw_material.name).toBeDefined();
      expect(response.body.stock_movement.batch).toBeDefined();
      expect(response.body.stock_movement.batch.batch_number).toBeDefined();
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(API_URL)
        .get('/api/v1/stock-movements/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });
});
