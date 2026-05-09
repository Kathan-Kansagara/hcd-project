import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Sales Order E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let locationId: string;
  let customerId: string;
  let rawMaterialId: string;
  let batchId: string;
  let salesOrderId: string;
  let createdSONumbers: string[] = [];

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `sotestadmin${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('sotestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'SO Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'sotestadmin123',
      });
    authToken = loginResponse.body.token;

    // Create test location
    const location = await prisma.location.create({
      data: { city: 'Test City', state: 'Test State', pincode: '123456' },
    });
    locationId = location.id;

    // Create test customer
    const customer = await prisma.customer.create({
      data: {
        company_name: 'Test Customer Ltd',
        contact: '+911234567890',
        email: `customer${timestamp}@test.com`,
        address_line1: 'Test Address',
        location_id: locationId,
        place_of_supply: '24-Gujarat',
        payment_terms: 'Net 30',
        created_by: adminUserId,
      },
    });
    customerId = customer.id;

    // Create test raw material
    const rm = await prisma.rawMaterial.create({
      data: {
        code: `SO-RM-${timestamp}`,
        name: 'Test Product A',
        category: 'FINISHED_PRODUCT',
        unit: 'LITER',
        gst_rate: 18,
        hsn_sac_code: '3808',
        weighted_average_cost: 100,
        current_stock_quantity: 500,
        created_by: adminUserId,
      },
    });
    rawMaterialId = rm.id;

    // Create test batch with stock
    const batch = await prisma.rawMaterialBatch.create({
      data: {
        batch_number: `SO-BATCH-${timestamp}`,
        raw_material_id: rawMaterialId,
        quantity_received: 500,
        quantity_remaining: 500,
        unit: 'LITER',
        receipt_date: new Date(),
        created_by: adminUserId,
      },
    });
    batchId = batch.id;
  });

  afterAll(async () => {
    // Clean up
    try {
      await prisma.stockMovement.deleteMany({
        where: { reference_type: 'SalesOrder' },
      });

      if (createdSONumbers.length > 0) {
        await prisma.salesOrderItem.deleteMany({
          where: { sales_order: { so_number: { in: createdSONumbers } } },
        });
        await prisma.salesOrder.deleteMany({
          where: { so_number: { in: createdSONumbers } },
        });
      }

      if (batchId) {
        await prisma.rawMaterialBatch.deleteMany({
          where: { id: batchId },
        });
      }

      if (rawMaterialId) {
        await prisma.rawMaterial.deleteMany({
          where: { id: rawMaterialId },
        });
      }

      if (customerId) {
        await prisma.customer.deleteMany({
          where: { id: customerId },
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

  describe('POST /api/v1/sales-orders - Create SO', () => {
    it('should create a sales order with auto-generated SO number', async () => {
      const response = await request(API_URL)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: customerId,
          order_date: '2025-10-20',
          expected_delivery_date: '2025-10-27',
          items: [
            {
              raw_material_id: rawMaterialId,
              batch_id: batchId,
              quantity: 50,
              unit_price: 150,
              gst_rate: 18,
            },
          ],
          notes: 'Test SO',
        });

      expect(response.status).toBe(201);
      expect(response.body.salesOrder).toBeDefined();
      expect(response.body.salesOrder.so_number).toMatch(/^SO-\d{4}-\d{3}(-\d+)?$/);
      expect(response.body.salesOrder.items).toHaveLength(1);
      expect(Number(response.body.salesOrder.items[0].amount)).toBe(50 * 150); // 7500
      expect(Number(response.body.salesOrder.items[0].gst_amount)).toBe(7500 * 0.18); // 1350
      expect(Number(response.body.salesOrder.items[0].total_amount)).toBe(7500 + 1350); // 8850

      salesOrderId = response.body.salesOrder.id;
      createdSONumbers.push(response.body.salesOrder.so_number);
    });

    it('should validate stock availability', async () => {
      const response = await request(API_URL)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: customerId,
          order_date: '2025-10-20',
          items: [
            {
              raw_material_id: rawMaterialId,
              batch_id: batchId,
              quantity: 10000, // More than available
              unit_price: 150,
              gst_rate: 18,
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient stock');
    });

    it('should calculate amounts correctly with GST', async () => {
      const response = await request(API_URL)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: customerId,
          order_date: '2025-10-20',
          items: [
            {
              raw_material_id: rawMaterialId,
              batch_id: batchId,
              quantity: 25,
              unit_price: 200,
              gst_rate: 18,
            },
          ],
        });

      expect(response.status).toBe(201);
      const item = response.body.salesOrder.items[0];
      expect(Number(item.amount)).toBe(5000); // 25 * 200
      expect(Number(item.gst_amount)).toBe(900); // 5000 * 0.18
      expect(Number(item.total_amount)).toBe(5900); // 5000 + 900

      createdSONumbers.push(response.body.salesOrder.so_number);
    });

    it('should reject SO without required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: customerId,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('order date');
    });
  });

  describe('GET /api/v1/sales-orders - List SOs', () => {
    it('should retrieve all sales orders with pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.salesOrders).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter sales orders by customer', async () => {
      const response = await request(API_URL)
        .get('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ customer_id: customerId });

      expect(response.status).toBe(200);
      expect(response.body.salesOrders).toBeDefined();
      response.body.salesOrders.forEach((so: any) => {
        expect(so.customer_id).toBe(customerId);
      });
    });

    it('should filter sales orders by status', async () => {
      const response = await request(API_URL)
        .get('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'PENDING' });

      expect(response.status).toBe(200);
      expect(response.body.salesOrders).toBeDefined();
      response.body.salesOrders.forEach((so: any) => {
        expect(so.status).toBe('PENDING');
      });
    });
  });

  describe('GET /api/v1/sales-orders/:id - Get SO by ID', () => {
    it('should retrieve a specific sales order', async () => {
      // Use salesOrderId from create test, or create one if not set (e.g. if create test failed earlier)
      let soId = salesOrderId;
      if (!soId) {
        const createResponse = await request(API_URL)
          .post('/api/v1/sales-orders')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            customer_id: customerId,
            order_date: '2025-10-20',
            items: [
              {
                raw_material_id: rawMaterialId,
                batch_id: batchId,
                quantity: 5,
                unit_price: 150,
                gst_rate: 18,
              },
            ],
          });
        expect(createResponse.status).toBe(201);
        soId = createResponse.body.salesOrder.id;
        createdSONumbers.push(createResponse.body.salesOrder.so_number);
      }

      const response = await request(API_URL)
        .get(`/api/v1/sales-orders/${soId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.salesOrder).toBeDefined();
      expect(response.body.salesOrder.id).toBe(soId);
      expect(response.body.salesOrder.customer_rel).toBeDefined();
      expect(response.body.salesOrder.items).toBeDefined();
    });

    it('should return 404 for non-existent SO', async () => {
      const response = await request(API_URL)
        .get('/api/v1/sales-orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/sales-orders/:id/cancel - Cancel SO', () => {
    it('should cancel a pending sales order', async () => {
      // Create a SO to cancel
      const createResponse = await request(API_URL)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: customerId,
          order_date: '2025-10-20',
          items: [
            {
              raw_material_id: rawMaterialId,
              batch_id: batchId,
              quantity: 10,
              unit_price: 150,
              gst_rate: 18,
            },
          ],
        });

      createdSONumbers.push(createResponse.body.salesOrder.so_number);
      const soId = createResponse.body.salesOrder.id;

      const response = await request(API_URL)
        .delete(`/api/v1/sales-orders/${soId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('cancelled');

      // Verify SO is cancelled
      const verifyResponse = await request(API_URL)
        .get(`/api/v1/sales-orders/${soId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(verifyResponse.body.salesOrder.status).toBe('CANCELLED');
    });
  });
});
