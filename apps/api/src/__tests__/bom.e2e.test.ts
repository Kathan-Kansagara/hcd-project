import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('BOM (Bill of Materials) E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let productId: string;
  let rawMaterial1Id: string;
  let rawMaterial2Id: string;
  let bomItem1Id: string;
  let bomItem2Id: string;

  beforeAll(async () => {
    // Clean up any previous test data first
    await prisma.rawMaterialBatch.deleteMany({
      where: {
        raw_material: {
          code: { in: ['BOM-RM-001', 'BOM-RM-002'] },
        },
      },
    });
    await prisma.rawMaterial.deleteMany({
      where: { code: { in: ['BOM-RM-001', 'BOM-RM-002'] } },
    });
    await prisma.product.deleteMany({
      where: { name: 'BOM Test Product' },
    });
    await prisma.user.deleteMany({
      where: { email: 'bomtestadmin@zenon.com' },
    });

    // Create test admin user
    const adminPassword = await bcrypt.hash('bomtestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'bomtestadmin@zenon.com',
        password_hash: adminPassword,
        name: 'BOM Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: 'bomtestadmin@zenon.com',
        password: 'bomtestadmin123',
      });
    authToken = loginResponse.body.token;

    // Create test product
    const product = await prisma.product.create({
      data: {
        name: 'BOM Test Product',
        description: 'Test product for BOM',
        category: 'Growth Enhancer',
        created_by: adminUserId,
      },
    });
    productId = product.id;

    // Create test raw materials
    const rm1 = await prisma.rawMaterial.create({
      data: {
        code: 'BOM-RM-001',
        name: 'Active Ingredient A',
        category: 'ACTIVE_INGREDIENT',
        unit: 'KG',
        created_by: adminUserId,
      },
    });
    rawMaterial1Id = rm1.id;

    const rm2 = await prisma.rawMaterial.create({
      data: {
        code: 'BOM-RM-002',
        name: '100ml Bottle',
        category: 'PACKAGING_PRIMARY',
        unit: 'PIECE',
        created_by: adminUserId,
      },
    });
    rawMaterial2Id = rm2.id;
  });

  afterAll(async () => {
    // Clean up - delete in correct order to respect foreign keys
    await prisma.billOfMaterialItem.deleteMany({
      where: { product_id: productId },
    });
    // Delete RM batches first before deleting raw materials
    await prisma.rawMaterialBatch.deleteMany({
      where: { raw_material_id: { in: [rawMaterial1Id, rawMaterial2Id].filter(Boolean) } },
    });
    await prisma.rawMaterial.deleteMany({
      where: { id: { in: [rawMaterial1Id, rawMaterial2Id].filter(Boolean) } },
    });
    await prisma.product.deleteMany({
      where: { id: productId },
    });
    await prisma.user.deleteMany({
      where: { id: adminUserId },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/bom - Create BOM Item', () => {
    it('should create a BOM item', async () => {
      const response = await request(API_URL)
        .post('/api/v1/bom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          raw_material_id: rawMaterial1Id,
          quantity_per_unit: 0.5,
          unit: 'KG',
          notes: '0.5 kg per liter of product',
        });

      expect(response.status).toBe(201);
      expect(response.body.bom_item).toBeDefined();
      expect(response.body.bom_item.quantity_per_unit).toBe(0.5);
      expect(response.body.bom_item.product).toBeDefined();
      expect(response.body.bom_item.raw_material).toBeDefined();

      bomItem1Id = response.body.bom_item.id;
    });

    it('should create another BOM item for same product', async () => {
      const response = await request(API_URL)
        .post('/api/v1/bom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          raw_material_id: rawMaterial2Id,
          quantity_per_unit: 1,
          unit: 'PIECE',
          notes: '1 piece per liter',
        });

      expect(response.status).toBe(201);
      bomItem2Id = response.body.bom_item.id;
    });

    it('should reject BOM item without required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/bom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject duplicate BOM item (same product + raw material)', async () => {
      const response = await request(API_URL)
        .post('/api/v1/bom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          raw_material_id: rawMaterial1Id,
          quantity_per_unit: 1,
          unit: 'KG',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already in the BOM');
    });

    it('should reject BOM item with non-existent product', async () => {
      const response = await request(API_URL)
        .post('/api/v1/bom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: '00000000-0000-0000-0000-000000000000',
          raw_material_id: rawMaterial1Id,
          quantity_per_unit: 1,
          unit: 'KG',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Product not found');
    });
  });

  describe('GET /api/v1/bom/product/:product_id - Get BOM by Product', () => {
    it('should get BOM for a product', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/bom/product/${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.product).toBeDefined();
      expect(response.body.bom_items).toBeInstanceOf(Array);
      expect(response.body.bom_items.length).toBe(2);
      expect(response.body.total_items).toBe(2);

      // Verify items include raw material details
      response.body.bom_items.forEach((item: any) => {
        expect(item.raw_material).toBeDefined();
        expect(item.quantity_per_unit).toBeDefined();
      });
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(API_URL)
        .get('/api/v1/bom/product/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/bom/:id - Update BOM Item', () => {
    it('should update BOM item quantity', async () => {
      const response = await request(API_URL)
        .put(`/api/v1/bom/${bomItem1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity_per_unit: 0.75,
          notes: 'Updated to 0.75 kg per liter',
        });

      expect(response.status).toBe(200);
      expect(response.body.bom_item.quantity_per_unit).toBe(0.75);
      expect(response.body.bom_item.notes).toBe('Updated to 0.75 kg per liter');
    });

    it('should return 404 for non-existent BOM item', async () => {
      const response = await request(API_URL)
        .put('/api/v1/bom/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity_per_unit: 1,
        });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/bom/product/:product_id/calculate - Calculate Material Requirements', () => {
    it('should calculate material requirements for production', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/bom/product/${productId}/calculate?quantity_to_produce=100`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.quantity_to_produce).toBe(100);
      expect(response.body.requirements).toBeInstanceOf(Array);
      expect(response.body.requirements.length).toBe(2);

      // Verify calculations
      const activeIngredient = response.body.requirements.find(
        (r: any) => r.raw_material_code === 'BOM-RM-001'
      );
      expect(activeIngredient.quantity_needed).toBe(75); // 0.75 * 100

      const bottles = response.body.requirements.find(
        (r: any) => r.raw_material_code === 'BOM-RM-002'
      );
      expect(bottles.quantity_needed).toBe(100); // 1 * 100
    });

    it('should reject calculation without quantity', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/bom/product/${productId}/calculate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/bom/product/:product_id/check-availability - Check Material Availability', () => {
    it('should check if materials are available for production', async () => {
      // First, create some RM batches
      await prisma.rawMaterialBatch.create({
        data: {
          raw_material_id: rawMaterial1Id,
          batch_number: 'BOM-TEST-BATCH-001',
          receipt_date: new Date(),
          quantity_received: 100,
          quantity_remaining: 100,
          unit: 'KG',
          quality_status: 'APPROVED',
          created_by: adminUserId,
        },
      });

      await prisma.rawMaterialBatch.create({
        data: {
          raw_material_id: rawMaterial2Id,
          batch_number: 'BOM-TEST-BATCH-002',
          receipt_date: new Date(),
          quantity_received: 200,
          quantity_remaining: 200,
          unit: 'PIECE',
          quality_status: 'APPROVED',
          created_by: adminUserId,
        },
      });

      const response = await request(API_URL)
        .get(`/api/v1/bom/product/${productId}/check-availability?quantity_to_produce=100`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.can_produce).toBe(true);
      expect(response.body.availability_checks).toBeInstanceOf(Array);

      // All materials should be available
      response.body.availability_checks.forEach((check: any) => {
        expect(check.is_available).toBe(true);
        expect(check.shortage).toBe(0);
      });
    });

    it('should detect shortages when materials are insufficient', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/bom/product/${productId}/check-availability?quantity_to_produce=500`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.can_produce).toBe(false);
      expect(response.body.shortages.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/v1/bom/:id - Delete BOM Item', () => {
    it('should delete a BOM item', async () => {
      const response = await request(API_URL)
        .delete(`/api/v1/bom/${bomItem2Id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify deletion
      const getBom = await request(API_URL)
        .get(`/api/v1/bom/product/${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getBom.body.bom_items.length).toBe(1);
    });

    it('should return 404 for non-existent BOM item', async () => {
      const response = await request(API_URL)
        .delete('/api/v1/bom/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
