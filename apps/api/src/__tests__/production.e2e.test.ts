import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Production with RM Consumption E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let productId: string;
  let productNoBomId: string;
  let rawMaterial1Id: string;
  let rawMaterial2Id: string;
  let rmBatch1Id: string;
  let rmBatch2Id: string;
  let finishedBatchId: string;
  let createdBatchNumbers: string[] = [];
  let rmBatch1Number: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `prodtest${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('prodtestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'Production Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'prodtestadmin123',
      });
    authToken = loginResponse.body.token;

    // Create test product (with BOM) - use timestamp for unique name
    const product = await prisma.product.create({
      data: {
        name: `Production Test Product ${timestamp}`,
        description: 'Test product for production',
        category: 'Growth Enhancer',
        created_by: adminUserId,
      },
    });
    productId = product.id;

    // Create product without BOM (for backward-compatible batch creation)
    const productNoBom = await prisma.product.create({
      data: {
        name: `Production Test Product No BOM ${timestamp}`,
        description: 'Product with no BOM for backward compatibility test',
        category: 'Growth Enhancer',
        created_by: adminUserId,
      },
    });
    productNoBomId = productNoBom.id;

    // Create raw materials
    const rm1 = await prisma.rawMaterial.create({
      data: {
        code: `PROD-RM-001-${timestamp}`,
        name: 'Nitrogen Compound',
        category: 'ACTIVE_INGREDIENT',
        unit: 'KG',
        created_by: adminUserId,
      },
    });
    rawMaterial1Id = rm1.id;

    const rm2 = await prisma.rawMaterial.create({
      data: {
        code: `PROD-RM-002-${timestamp}`,
        name: '250ml Bottle with Cap',
        category: 'PACKAGING_PRIMARY',
        specifications: {
          size: '250ml',
          material: 'HDPE',
          cap_torque: '18 Nm',
        },
        unit: 'PIECE',
        created_by: adminUserId,
      },
    });
    rawMaterial2Id = rm2.id;

    // Create BOM
    await prisma.billOfMaterialItem.create({
      data: {
        product_id: productId,
        raw_material_id: rawMaterial1Id,
        quantity_per_unit: 0.25,
        unit: 'KG',
        notes: '0.25 kg per liter',
        created_by: adminUserId,
      },
    });

    await prisma.billOfMaterialItem.create({
      data: {
        product_id: productId,
        raw_material_id: rawMaterial2Id,
        quantity_per_unit: 4,
        unit: 'PIECE',
        notes: '4 pieces per liter (250ml each)',
        created_by: adminUserId,
      },
    });

    // Create RM batches with stock (timestamp for unique batch_number)
    const rmBatch1 = await prisma.rawMaterialBatch.create({
      data: {
        raw_material_id: rawMaterial1Id,
        batch_number: `PROD-RMBATCH-001-${timestamp}`,
        receipt_date: new Date('2025-01-01'),
        expiry_date: new Date('2026-01-01'),
        quantity_received: 100,
        quantity_remaining: 100,
        unit: 'KG',
        quality_status: 'APPROVED',
        created_by: adminUserId,
      },
    });
    rmBatch1Id = rmBatch1.id;
    rmBatch1Number = rmBatch1.batch_number;

    const rmBatch2 = await prisma.rawMaterialBatch.create({
      data: {
        raw_material_id: rawMaterial2Id,
        batch_number: `PROD-RMBATCH-002-${timestamp}`,
        receipt_date: new Date('2025-01-15'),
        expiry_date: new Date('2026-01-15'),
        quantity_received: 1000,
        quantity_remaining: 1000,
        unit: 'PIECE',
        quality_parameters: {
          cap_tightness: '18 Nm',
          leak_test: 'Pass',
        },
        quality_status: 'APPROVED',
        created_by: adminUserId,
      },
    });
    rmBatch2Id = rmBatch2.id;
  });

  afterAll(async () => {
    try {
      // Clean up
      if (createdBatchNumbers.length > 0) {
        await prisma.rawMaterialConsumption.deleteMany({
          where: { finished_batch: { batch_number: { in: createdBatchNumbers } } },
        });
        await prisma.batch.deleteMany({
          where: { batch_number: { in: createdBatchNumbers } },
        });
      }
      if (productId) {
        await prisma.billOfMaterialItem.deleteMany({
          where: { product_id: productId },
        });
      }
      if (productNoBomId) {
        await prisma.product.deleteMany({
          where: { id: productNoBomId },
        });
      }
      await prisma.rawMaterialBatch.deleteMany({
        where: { id: { in: [rmBatch1Id, rmBatch2Id].filter(Boolean) } },
      });
      await prisma.rawMaterial.deleteMany({
        where: { id: { in: [rawMaterial1Id, rawMaterial2Id].filter(Boolean) } },
      });
      if (productId) {
        await prisma.product.deleteMany({
          where: { id: productId },
        });
      }
      if (adminUserId) {
        await prisma.user.deleteMany({
          where: { id: adminUserId },
        });
      }
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('POST /api/v1/production/batch-with-consumption - Create Batch with RM Consumption', () => {
    it('should create finished batch and record RM consumption', async () => {
      const response = await request(API_URL)
        .post('/api/v1/production/batch-with-consumption')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          batch_number: 'FINISHED-BATCH-001',
          manufacturing_date: '2025-10-20',
          expiry_date: '2026-10-20',
          quantity_produced: 10,
          unit: 'LITER',
          storage_location: 'Warehouse 1',
          notes: 'Test production run',
          raw_material_consumptions: [
            {
              raw_material_batch_id: rmBatch1Id,
              quantity_consumed: 2.5, // 10 liters * 0.25 kg/liter
              unit: 'KG',
            },
            {
              raw_material_batch_id: rmBatch2Id,
              quantity_consumed: 40, // 10 liters * 4 bottles/liter
              unit: 'PIECE',
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.batch).toBeDefined();
      expect(response.body.batch.batch_number).toBe('FINISHED-BATCH-001');
      expect(response.body.batch.rm_consumptions).toBeInstanceOf(Array);
      expect(response.body.batch.rm_consumptions.length).toBe(2);
      expect(response.body.consumptions_recorded).toBe(2);

      finishedBatchId = response.body.batch.id;
      createdBatchNumbers.push('FINISHED-BATCH-001');

      // Verify RM batch quantities were reduced
      const rmBatch1After = await prisma.rawMaterialBatch.findUnique({
        where: { id: rmBatch1Id },
      });
      expect(rmBatch1After?.quantity_remaining).toBe(97.5); // 100 - 2.5

      const rmBatch2After = await prisma.rawMaterialBatch.findUnique({
        where: { id: rmBatch2Id },
      });
      expect(rmBatch2After?.quantity_remaining).toBe(960); // 1000 - 40
    });

    it('should create batch without RM consumption (backward compatible)', async () => {
      // Use product with no BOM - controller auto-consumes only when BOM exists
      const batchNum = `FINISHED-BATCH-002-${Date.now()}`;
      const response = await request(API_URL)
        .post('/api/v1/production/batch-with-consumption')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productNoBomId,
          batch_number: batchNum,
          manufacturing_date: '2025-10-21',
          expiry_date: '2026-10-21',
          quantity_produced: 5,
          unit: 'LITER',
        });

      expect(response.status).toBe(201);
      expect(response.body.consumptions_recorded).toBe(0);
      createdBatchNumbers.push(batchNum);
    });

    it('should reject if insufficient RM stock', async () => {
      const response = await request(API_URL)
        .post('/api/v1/production/batch-with-consumption')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          batch_number: 'FINISHED-BATCH-FAIL',
          manufacturing_date: '2025-10-22',
          expiry_date: '2026-10-22',
          quantity_produced: 1000,
          unit: 'LITER',
          raw_material_consumptions: [
            {
              raw_material_batch_id: rmBatch1Id,
              quantity_consumed: 250, // More than available
              unit: 'KG',
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient stock');
    });

    it('should reject duplicate batch number', async () => {
      const response = await request(API_URL)
        .post('/api/v1/production/batch-with-consumption')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          batch_number: 'FINISHED-BATCH-001', // Duplicate
          manufacturing_date: '2025-10-22',
          expiry_date: '2026-10-22',
          quantity_produced: 5,
          unit: 'LITER',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('GET /api/v1/production/batch/:id/traceability - Get Batch Traceability', () => {
    it('should get complete traceability for finished batch', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/production/batch/${finishedBatchId}/traceability`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.finished_batch).toBeDefined();
      expect(response.body.raw_materials_used).toBeInstanceOf(Array);
      expect(response.body.raw_materials_used.length).toBe(2);

      // Verify RM details are included (codes use timestamp suffix e.g. PROD-RM-001-1234567890)
      const nitrogenCompound = response.body.raw_materials_used.find(
        (rm: any) => rm.raw_material.code.startsWith('PROD-RM-001')
      );
      expect(nitrogenCompound).toBeDefined();
      expect(nitrogenCompound.quantity_consumed).toBe(2.5);
      expect(nitrogenCompound.batch_number).toBe(rmBatch1Number);

      const bottles = response.body.raw_materials_used.find(
        (rm: any) => rm.raw_material.code.startsWith('PROD-RM-002')
      );
      expect(bottles).toBeDefined();
      expect(bottles.quantity_consumed).toBe(40);
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await request(API_URL)
        .get('/api/v1/production/batch/00000000-0000-0000-0000-000000000000/traceability')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/production/raw-material-batch/:id/traceability - Get RM Forward Traceability', () => {
    it('should get forward traceability for RM batch', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/production/raw-material-batch/${rmBatch1Id}/traceability`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.raw_material_batch).toBeDefined();
      expect(response.body.used_in_batches).toBeInstanceOf(Array);
      expect(response.body.used_in_batches.length).toBeGreaterThan(0);

      // Verify finished batch details
      const usageRecord = response.body.used_in_batches[0];
      expect(usageRecord.finished_batch).toBeDefined();
      expect(usageRecord.finished_batch.batch_number).toBe('FINISHED-BATCH-001');
      expect(usageRecord.quantity_consumed).toBe(2.5);
    });

    it('should show RM with quality parameters', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/production/raw-material-batch/${rmBatch2Id}/traceability`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.raw_material_batch.raw_material.specifications).toBeDefined();
      expect(response.body.raw_material_batch.raw_material.specifications.cap_torque).toBe('18 Nm');
    });

    it('should return 404 for non-existent RM batch', async () => {
      const response = await request(API_URL)
        .get('/api/v1/production/raw-material-batch/00000000-0000-0000-0000-000000000000/traceability')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
