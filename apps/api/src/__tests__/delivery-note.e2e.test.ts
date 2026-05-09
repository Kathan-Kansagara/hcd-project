import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Delivery Note E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let locationId: string;
  let customerId: string;
  let rawMaterialId: string;
  let batchId: string;
  let salesOrderId: string;
  let deliveryNoteId: string;
  let createdDNNumbers: string[] = [];
  let createdSONumbers: string[] = [];
  let batchesToCleanup: string[] = [];

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `dntestadmin${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('dntestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'DN Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'dntestadmin123',
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
        company_name: 'DN Test Customer Ltd',
        contact: '+911234567890',
        email: `dncustomer${timestamp}@test.com`,
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
        code: `DN-RM-${timestamp}`,
        name: 'DN Test Product',
        category: 'FINISHED_PRODUCT',
        unit: 'LITER',
        gst_rate: 18,
        hsn_sac_code: '3808',
        weighted_average_cost: 100,
        current_stock_quantity: 1000,
        created_by: adminUserId,
      },
    });
    rawMaterialId = rm.id;

    // Create test batch with stock
    const batch = await prisma.rawMaterialBatch.create({
      data: {
        batch_number: `DN-BATCH-${timestamp}`,
        raw_material_id: rawMaterialId,
        quantity_received: 1000,
        quantity_remaining: 1000,
        unit: 'LITER',
        receipt_date: new Date(),
        created_by: adminUserId,
      },
    });
    batchId = batch.id;

    // Create test sales order
    const soResponse = await request(API_URL)
      .post('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customer_id: customerId,
        order_date: '2025-10-20',
        items: [
          {
            raw_material_id: rawMaterialId,
            batch_id: batchId,
            quantity: 100,
            unit_price: 150,
            gst_rate: 18,
          },
        ],
      });

    if (soResponse.status !== 201 || !soResponse.body.salesOrder) {
      throw new Error(
        `SO creation failed: status=${soResponse.status} body=${JSON.stringify(soResponse.body)}`
      );
    }
    salesOrderId = soResponse.body.salesOrder.id;
    createdSONumbers.push(soResponse.body.salesOrder.so_number);
  });

  afterAll(async () => {
    try {
      await prisma.stockMovement.deleteMany({
        where: { reference_type: 'SalesOrder' },
      });

      if (createdDNNumbers.length > 0) {
        await prisma.deliveryNoteItem.deleteMany({
          where: { delivery_note: { dn_number: { in: createdDNNumbers } } },
        });
        await prisma.deliveryNote.deleteMany({
          where: { dn_number: { in: createdDNNumbers } },
        });
      }

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
      if (batchesToCleanup.length > 0) {
        await prisma.rawMaterialBatch.deleteMany({
          where: { id: { in: batchesToCleanup } },
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

  describe('POST /api/v1/delivery-notes - Create DN', () => {
    it('should create a delivery note from sales order', async () => {
      const response = await request(API_URL)
        .post('/api/v1/delivery-notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sales_order_id: salesOrderId,
          delivery_date: '2025-10-25',
          items: [
            {
              sales_order_item_id: (
                await prisma.salesOrder.findUnique({
                  where: { id: salesOrderId },
                  include: { items: true },
                })
              )!.items[0].id,
              quantity_delivered: 100,
            },
          ],
          notes: 'Test delivery',
        });

      expect(response.status).toBe(201);
      expect(response.body.deliveryNote).toBeDefined();
      expect(response.body.deliveryNote.dn_number).toMatch(/^DN-\d{4}-\d{3}(-\d+)?$/);
      expect(response.body.deliveryNote.items).toHaveLength(1);

      deliveryNoteId = response.body.deliveryNote.id;
      createdDNNumbers.push(response.body.deliveryNote.dn_number);
    });

    it('should reduce stock when creating delivery note', async () => {
      // Create another SO for this test
      const soResponse = await request(API_URL)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: customerId,
          order_date: '2025-10-20',
          items: [
            {
              raw_material_id: rawMaterialId,
              batch_id: batchId,
              quantity: 50,
              unit_price: 150,
              gst_rate: 18,
            },
          ],
        });

      createdSONumbers.push(soResponse.body.salesOrder.so_number);
      const newSOId = soResponse.body.salesOrder.id;

      // Get current stock
      const batchBefore = await prisma.rawMaterialBatch.findUnique({
        where: { id: batchId },
      });
      const rmBefore = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterialId },
      });

      // Create delivery note
      const dnResponse = await request(API_URL)
        .post('/api/v1/delivery-notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sales_order_id: newSOId,
          delivery_date: '2025-10-25',
          items: [
            {
              sales_order_item_id: (
                await prisma.salesOrder.findUnique({
                  where: { id: newSOId },
                  include: { items: true },
                })
              )!.items[0].id,
              quantity_delivered: 50,
            },
          ],
        });

      createdDNNumbers.push(dnResponse.body.deliveryNote.dn_number);

      // Verify stock reduced
      const batchAfter = await prisma.rawMaterialBatch.findUnique({
        where: { id: batchId },
      });
      const rmAfter = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterialId },
      });

      expect(Number(batchAfter!.quantity_remaining)).toBe(Number(batchBefore!.quantity_remaining) - 50);
      expect(Number(rmAfter!.current_stock_quantity)).toBe(Number(rmBefore!.current_stock_quantity) - 50);
    });

    it('should update sales order status to DELIVERED', async () => {
      // Create another SO
      const soResponse = await request(API_URL)
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
              unit_price: 150,
              gst_rate: 18,
            },
          ],
        });

      createdSONumbers.push(soResponse.body.salesOrder.so_number);
      const newSOId = soResponse.body.salesOrder.id;

      // Create DN
      const dnResponse = await request(API_URL)
        .post('/api/v1/delivery-notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sales_order_id: newSOId,
          delivery_date: '2025-10-25',
          items: [
            {
              sales_order_item_id: (
                await prisma.salesOrder.findUnique({
                  where: { id: newSOId },
                  include: { items: true },
                })
              )!.items[0].id,
            },
          ],
        });

      createdDNNumbers.push(dnResponse.body.deliveryNote.dn_number);

      // Verify SO status
      const soAfter = await prisma.salesOrder.findUnique({
        where: { id: newSOId },
      });

      expect(soAfter!.status).toBe('DELIVERED');
    });

    it('should validate insufficient stock', async () => {
      // Create a dedicated batch for this test to ensure known stock (shared batch may be depleted)
      const timestamp = Date.now();
      const insufBatch = await prisma.rawMaterialBatch.create({
        data: {
          batch_number: `DN-INSUF-BATCH-${timestamp}`,
          raw_material_id: rawMaterialId,
          quantity_received: 100,
          quantity_remaining: 100,
          unit: 'LITER',
          receipt_date: new Date(),
          created_by: adminUserId,
        },
      });

      const soResponse = await request(API_URL)
        .post('/api/v1/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: customerId,
          order_date: '2025-10-20',
          items: [
            {
              raw_material_id: rawMaterialId,
              batch_id: insufBatch.id,
              quantity: 10,
              unit_price: 150,
              gst_rate: 18,
            },
          ],
        });

      expect(soResponse.status).toBe(201);
      expect(soResponse.body.salesOrder).toBeDefined();

      createdSONumbers.push(soResponse.body.salesOrder.so_number);
      const newSOId = soResponse.body.salesOrder.id;

      // Try to deliver more than ordered
      const response = await request(API_URL)
        .post('/api/v1/delivery-notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sales_order_id: newSOId,
          delivery_date: '2025-10-25',
          items: [
            {
              sales_order_item_id: (
                await prisma.salesOrder.findUnique({
                  where: { id: newSOId },
                  include: { items: true },
                })
              )!.items[0].id,
              quantity_delivered: 10000,
            },
          ],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Insufficient stock');

      batchesToCleanup.push(insufBatch.id);
    });

    it('should reject DN for already delivered SO', async () => {
      const response = await request(API_URL)
        .post('/api/v1/delivery-notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sales_order_id: salesOrderId,
          delivery_date: '2025-10-26',
          items: [
            {
              sales_order_item_id: (
                await prisma.salesOrder.findUnique({
                  where: { id: salesOrderId },
                  include: { items: true },
                })
              )!.items[0].id,
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already delivered or cancelled');
    });
  });

  describe('GET /api/v1/delivery-notes - List DNs', () => {
    it('should retrieve all delivery notes with pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/delivery-notes')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.deliveryNotes).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter delivery notes by customer', async () => {
      const response = await request(API_URL)
        .get('/api/v1/delivery-notes')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ customer_id: customerId });

      expect(response.status).toBe(200);
      expect(response.body.deliveryNotes).toBeDefined();
      response.body.deliveryNotes.forEach((dn: any) => {
        expect(dn.customer_id).toBe(customerId);
      });
    });
  });

  describe('GET /api/v1/delivery-notes/:id - Get DN by ID', () => {
    it('should retrieve a specific delivery note', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/delivery-notes/${deliveryNoteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.deliveryNote).toBeDefined();
      expect(response.body.deliveryNote.id).toBe(deliveryNoteId);
      expect(response.body.deliveryNote.customer_rel).toBeDefined();
      expect(response.body.deliveryNote.items).toBeDefined();
    });

    it('should return 404 for non-existent DN', async () => {
      const response = await request(API_URL)
        .get('/api/v1/delivery-notes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
