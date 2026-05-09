import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Purchase Order E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let locationId: string;
  let supplierId: string;
  let rawMaterial1Id: string;
  let rawMaterial2Id: string;
  let rawMaterial1Code: string;
  let rawMaterial2Code: string;
  let purchaseOrderId: string;
  let poNumber: string;
  let createdPONumbers: string[] = [];

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `potest${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('potestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'PO Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'potestadmin123',
      });
    authToken = loginResponse.body.token;

    // Create test location
    const location = await prisma.location.create({
      data: { city: 'Test City', state: 'Test State', pincode: '123456' },
    });
    locationId = location.id;

    // Create test supplier
    const supplier = await prisma.supplier.create({
      data: {
        company_name: `Test Supplier ${timestamp}`,
        contact: '+911234567890',
        email: `supplier${timestamp}@test.com`,
        address_line1: 'Test Address',
        location_id: locationId,
        payment_terms: 'Net 30',
        created_by: adminUserId,
      },
    });
    supplierId = supplier.id;

    // Create test raw materials (use timestamp to avoid unique constraint collisions)
    const rm1 = await prisma.rawMaterial.create({
      data: {
        code: `PO-RM-001-${timestamp}`,
        name: 'Test Chemical A',
        category: 'ACTIVE_INGREDIENT',
        unit: 'KG',
        gst_rate: 18,
        hsn_sac_code: '3808',
        weighted_average_cost: 100,
        current_stock_quantity: 50,
        created_by: adminUserId,
      },
    });
    rawMaterial1Id = rm1.id;
    rawMaterial1Code = rm1.code;

    const rm2 = await prisma.rawMaterial.create({
      data: {
        code: `PO-RM-002-${timestamp}`,
        name: 'Test Chemical B',
        category: 'ACTIVE_INGREDIENT',
        unit: 'KG',
        gst_rate: 12,
        hsn_sac_code: '3809',
        weighted_average_cost: 50,
        current_stock_quantity: 100,
        created_by: adminUserId,
      },
    });
    rawMaterial2Id = rm2.id;
    rawMaterial2Code = rm2.code;
  });

  afterAll(async () => {
    // Clean up in correct order - only delete if IDs exist
    try {
      await prisma.stockMovement.deleteMany({
        where: { reference_type: 'PurchaseOrder' },
      });

      if (rawMaterial1Id || rawMaterial2Id) {
        await prisma.rawMaterialBatch.deleteMany({
          where: {
            raw_material_id: {
              in: [rawMaterial1Id, rawMaterial2Id].filter(Boolean),
            },
          },
        });
      }

      if (createdPONumbers.length > 0) {
        await prisma.purchaseOrderItem.deleteMany({
          where: { purchase_order: { po_number: { in: createdPONumbers } } },
        });
        await prisma.purchaseOrder.deleteMany({
          where: { po_number: { in: createdPONumbers } },
        });
      }

      if (rawMaterial1Id || rawMaterial2Id) {
        await prisma.rawMaterial.deleteMany({
          where: { id: { in: [rawMaterial1Id, rawMaterial2Id].filter(Boolean) } },
        });
      }

      if (supplierId) {
        await prisma.supplier.deleteMany({
          where: { id: supplierId },
        });
      }

      if (locationId) {
        await prisma.location.deleteMany({
          where: { id: locationId },
        });
      }

      if (adminUserId) {
        await prisma.user.deleteMany({
          where: { id: adminUserId },
        });
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    await prisma.$disconnect();
  });

  describe('POST /api/v1/purchase-orders - Create PO', () => {
    it('should create a purchase order with auto-generated PO number', async () => {
      const response = await request(API_URL)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          supplier_id: supplierId,
          order_date: '2025-10-20',
          expected_delivery_date: '2025-10-27',
          items: [
            {
              raw_material_id: rawMaterial1Id,
              quantity: 100,
              unit: 'KG',
              unit_price: 120,
            },
            {
              raw_material_id: rawMaterial2Id,
              quantity: 50,
              unit: 'KG',
              unit_price: 55,
            },
          ],
          notes: 'Test PO creation',
        });

      expect(response.status).toBe(201);
      expect(response.body.purchase_order).toBeDefined();

      // Assign IDs first so dependent tests don't cascade-fail if assertions below fail
      purchaseOrderId = response.body.purchase_order.id;
      poNumber = response.body.purchase_order.po_number;
      createdPONumbers.push(poNumber);

      // PO number format: PO-YYYY-NNN or PO-YYYY-NNN-suffix (when collision occurs)
      expect(response.body.purchase_order.po_number).toMatch(/^PO-\d{4}-\d{3}(-\d+)?$/);
      expect(response.body.purchase_order.status).toBe('PENDING');
      expect(response.body.purchase_order.items).toBeInstanceOf(Array);
      expect(response.body.purchase_order.items.length).toBe(2);
    });
  });

  describe('POST /api/v1/purchase-orders/:id/mark-received - Receive PO', () => {
    it('should mark PO as received, create batches, update stock, and calculate weighted average cost', async () => {
      // Get initial stock values
      const rm1Before = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterial1Id },
      });
      const rm2Before = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterial2Id },
      });

      const response = await request(API_URL)
        .post(`/api/v1/purchase-orders/${purchaseOrderId}/mark-received`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          received_date: '2025-10-25',
          batches: [
            {
              raw_material_id: rawMaterial1Id,
              batch_number: 'PO-BATCH-001',
              quantity: 100,
              expiry_date: '2026-10-25',
            },
            {
              raw_material_id: rawMaterial2Id,
              batch_number: 'PO-BATCH-002',
              quantity: 50,
              expiry_date: '2026-10-25',
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.purchase_order.status).toBe('RECEIVED');
      expect(response.body.batches_created).toBe(2);
      expect(response.body.stock_movements_created).toBe(2);

      // Verify batches were created - controller auto-generates batch numbers as PO-{PO_NUMBER}-{RAW_MATERIAL_CODE}
      const expectedBatchNumbers = [`${poNumber}-${rawMaterial1Code}`, `${poNumber}-${rawMaterial2Code}`];
      const batches = await prisma.rawMaterialBatch.findMany({
        where: { batch_number: { in: expectedBatchNumbers } },
      });
      expect(batches.length).toBe(2);

      // Verify stock was updated and weighted average cost calculated
      const rm1After = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterial1Id },
      });
      // Convert Decimal to number for comparison
      const rm1AfterStock = rm1After?.current_stock_quantity?.toNumber
        ? rm1After.current_stock_quantity.toNumber()
        : Number(rm1After?.current_stock_quantity);
      expect(rm1AfterStock).toBe(rm1Before!.current_stock_quantity.toNumber() + 100);

      // Weighted average: ((50 * 100) + (100 * 120)) / (50 + 100) = 113.33
      const rm1AfterCost = rm1After?.weighted_average_cost?.toNumber
        ? rm1After.weighted_average_cost.toNumber()
        : Number(rm1After?.weighted_average_cost);
      expect(Math.abs(rm1AfterCost - 113.33)).toBeLessThan(0.01);

      const rm2After = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterial2Id },
      });
      const rm2AfterStock = rm2After?.current_stock_quantity?.toNumber
        ? rm2After.current_stock_quantity.toNumber()
        : Number(rm2After?.current_stock_quantity);
      expect(rm2AfterStock).toBe(rm2Before!.current_stock_quantity.toNumber() + 50);

      // Weighted average: ((100 * 50) + (50 * 55)) / (100 + 50) = 51.67
      const rm2AfterCost = rm2After?.weighted_average_cost?.toNumber
        ? rm2After.weighted_average_cost.toNumber()
        : Number(rm2After?.weighted_average_cost);
      expect(Math.abs(rm2AfterCost - 51.67)).toBeLessThan(0.01);

      // Verify stock movements were created
      const movements = await prisma.stockMovement.findMany({
        where: {
          reference_type: 'PurchaseOrder',
          reference_id: purchaseOrderId,
        },
      });
      expect(movements.length).toBe(2);
      expect(movements[0].movement_type).toBe('PURCHASE');
    });

    it('should reject if PO is already received', async () => {
      const response = await request(API_URL)
        .post(`/api/v1/purchase-orders/${purchaseOrderId}/mark-received`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          received_date: '2025-10-26',
          batches: [
            {
              raw_material_id: rawMaterial1Id,
              batch_number: 'PO-BATCH-003',
              quantity: 100,
              expiry_date: '2026-10-26',
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already been received');
    });
  });

  describe('GET /api/v1/purchase-orders - Get all POs', () => {
    it('should get all purchase orders with pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.purchase_orders).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThan(0);
    });

    it('should filter POs by status', async () => {
      const response = await request(API_URL)
        .get('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'RECEIVED' });

      expect(response.status).toBe(200);
      expect(response.body.purchase_orders).toBeInstanceOf(Array);
      response.body.purchase_orders.forEach((po: any) => {
        expect(po.status).toBe('RECEIVED');
      });
    });

    it('should filter POs by supplier', async () => {
      const response = await request(API_URL)
        .get('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ supplier_id: supplierId });

      expect(response.status).toBe(200);
      expect(response.body.purchase_orders).toBeInstanceOf(Array);
      response.body.purchase_orders.forEach((po: any) => {
        expect(po.supplier.id).toBe(supplierId);
      });
    });
  });

  describe('GET /api/v1/purchase-orders/:id - Get PO by ID', () => {
    it('should get a purchase order with all details', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/purchase-orders/${purchaseOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.purchase_order).toBeDefined();
      expect(response.body.purchase_order.id).toBe(purchaseOrderId);
      expect(response.body.purchase_order.items).toBeInstanceOf(Array);
      expect(response.body.purchase_order.supplier_rel).toBeDefined();
    });

    it('should return 404 for non-existent PO', async () => {
      const response = await request(API_URL)
        .get('/api/v1/purchase-orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
