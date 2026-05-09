import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Raw Materials E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let createdRawMaterialIds: string[] = [];
  const ts = Date.now();

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `rmtest${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('rmtestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'RM Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'rmtestadmin123',
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    try {
      // Clean up all created raw materials (must delete before user due to FK)
      await prisma.rawMaterial.deleteMany({
        where: { id: { in: createdRawMaterialIds.filter(Boolean) } },
      });
      // Also clean up any raw materials created by this user that weren't tracked
      await prisma.rawMaterial.deleteMany({
        where: { created_by: adminUserId },
      });
      await prisma.user.deleteMany({
        where: { id: adminUserId },
      });
    } catch (e) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('POST /api/v1/raw-materials - Create Raw Material', () => {
    it('should create a new raw material with all fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/raw-materials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `RM-TEST-001-${ts}`,
          name: `100ml HDPE Item ${ts}`,
          description: 'White cylindrical item',
          category: 'PACKAGING_PRIMARY',
          subcategory: 'BOTTLES',
          specifications: {
            size: '100ml',
            material: 'HDPE',
            color: 'White',
          },
          unit: 'PIECE',
          min_stock_level: 1000,
          reorder_point: 500,
          supplier_name: 'ABC Packaging',
        });

      expect(response.status).toBe(201);
      expect(response.body.raw_material).toBeDefined();
      expect(response.body.raw_material.code).toBe(`RM-TEST-001-${ts}`);
      expect(response.body.raw_material.name).toBe(`100ml HDPE Item ${ts}`);
      expect(response.body.raw_material.category).toBe('PACKAGING_PRIMARY');
      expect(response.body.raw_material.specifications).toEqual({
        size: '100ml',
        material: 'HDPE',
        color: 'White',
      });

      createdRawMaterialIds.push(response.body.raw_material.id);
    });

    it('should create raw material with only required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/raw-materials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `RM-TEST-002-${ts}`,
          name: `Nitrogen Compound ${ts}`,
          category: 'ACTIVE_INGREDIENT',
          unit: 'KG',
        });

      expect(response.status).toBe(201);
      expect(response.body.raw_material.code).toBe(`RM-TEST-002-${ts}`);
      expect(response.body.raw_material.description).toBeNull();

      createdRawMaterialIds.push(response.body.raw_material.id);
    });

    it('should reject raw material creation without required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/raw-materials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Missing Code',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject duplicate raw material codes', async () => {
      const response = await request(API_URL)
        .post('/api/v1/raw-materials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `RM-TEST-001-${ts}`, // Duplicate
          name: 'Duplicate Material',
          category: 'TEST',
          unit: 'KG',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject raw material creation without authentication', async () => {
      const response = await request(API_URL)
        .post('/api/v1/raw-materials')
        .send({
          code: 'RM-UNAUTH',
          name: 'Unauthorized Material',
          category: 'TEST',
          unit: 'KG',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/raw-materials - List Raw Materials', () => {
    it('should list all raw materials', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-materials')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.raw_materials).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter raw materials by search (code)', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/raw-materials?search=RM-TEST-001-${ts}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.raw_materials).toBeInstanceOf(Array);
      if (response.body.raw_materials.length > 0) {
        expect(response.body.raw_materials[0].code).toContain(`RM-TEST-001-${ts}`);
      }
    });

    it('should filter raw materials by category', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-materials?category=PACKAGING_PRIMARY')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.raw_materials.length > 0) {
        response.body.raw_materials.forEach((rm: any) => {
          expect(rm.category).toContain('PACKAGING_PRIMARY');
        });
      }
    });

    it('should support pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-materials?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.raw_materials.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.page).toBe(1);
    });

    it('should sort raw materials by created_at desc (newest first)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-materials')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.raw_materials.length > 1) {
        const firstRM = new Date(response.body.raw_materials[0].created_at);
        const secondRM = new Date(response.body.raw_materials[1].created_at);
        expect(firstRM.getTime()).toBeGreaterThanOrEqual(secondRM.getTime());
      }
    });
  });

  describe('GET /api/v1/raw-materials/:id - Get Raw Material by ID', () => {
    it('should get raw material details by ID', async () => {
      const rmId = createdRawMaterialIds[0];
      const response = await request(API_URL)
        .get(`/api/v1/raw-materials/${rmId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.raw_material).toBeDefined();
      expect(response.body.raw_material.id).toBe(rmId);
      expect(response.body.raw_material.stock_batches).toBeDefined();
      expect(response.body.raw_material.bom_items).toBeDefined();
    });

    it('should return 404 for non-existent raw material', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-materials/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/raw-materials/:id - Update Raw Material', () => {
    it('should update raw material details', async () => {
      const rmId = createdRawMaterialIds[0];
      const response = await request(API_URL)
        .put(`/api/v1/raw-materials/${rmId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description',
          min_stock_level: 1500,
          specifications: {
            size: '100ml',
            material: 'HDPE',
            color: 'White',
            cap_type: 'Screw Cap',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.raw_material.description).toBe('Updated description');
      expect(response.body.raw_material.min_stock_level).toBe(1500);
      expect(response.body.raw_material.specifications).toHaveProperty('cap_type');
    });

    it('should update raw material code', async () => {
      const rmId = createdRawMaterialIds[1];
      const response = await request(API_URL)
        .put(`/api/v1/raw-materials/${rmId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `RM-TEST-002-UPD-${ts}`,
        });

      expect(response.status).toBe(200);
      expect(response.body.raw_material.code).toBe(`RM-TEST-002-UPD-${ts}`);
    });

    it('should return 404 for non-existent raw material', async () => {
      const response = await request(API_URL)
        .put('/api/v1/raw-materials/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
        });

      expect(response.status).toBe(404);
    });

    it('should reject duplicate code on update', async () => {
      const rmId = createdRawMaterialIds[1];
      const response = await request(API_URL)
        .put(`/api/v1/raw-materials/${rmId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `RM-TEST-001-${ts}`, // Code of first material
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('DELETE /api/v1/raw-materials/:id - Delete Raw Material', () => {
    it('should delete a raw material without batches or BOM', async () => {
      // Create a material to delete
      const createResponse = await request(API_URL)
        .post('/api/v1/raw-materials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'RM-TO-DELETE',
          name: 'To Be Deleted',
          category: 'TEST',
          unit: 'KG',
        });

      const rmId = createResponse.body.raw_material.id;
      createdRawMaterialIds.push(rmId);

      // Delete the material
      const response = await request(API_URL)
        .delete(`/api/v1/raw-materials/${rmId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify material is deleted
      const deletedRM = await prisma.rawMaterial.findUnique({
        where: { id: rmId },
      });
      expect(deletedRM).toBeNull();
    });

    it('should return 404 for non-existent raw material', async () => {
      const response = await request(API_URL)
        .delete('/api/v1/raw-materials/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/raw-materials/categories/list - Get Categories', () => {
    it('should get distinct categories', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-materials/categories/list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.categories).toBeInstanceOf(Array);
      expect(response.body.categories.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/raw-materials/:id/stock-summary - Get Stock Summary', () => {
    it('should get stock summary for a raw material', async () => {
      const rmId = createdRawMaterialIds[0];
      const response = await request(API_URL)
        .get(`/api/v1/raw-materials/${rmId}/stock-summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.raw_material_id).toBe(rmId);
      expect(response.body.total_stock).toBeDefined();
      expect(response.body.unit).toBeDefined();
      expect(response.body.total_batches).toBeDefined();
    });

    it('should return 404 for non-existent raw material', async () => {
      const response = await request(API_URL)
        .get('/api/v1/raw-materials/00000000-0000-0000-0000-000000000000/stock-summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
