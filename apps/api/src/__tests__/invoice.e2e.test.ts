import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Invoice E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let locationId: string;
  let customerId: string;
  let rawMaterialId: string;
  let batchId: string;
  let salesOrderId: string;
  let deliveryNoteId: string;
  let invoiceId: string;
  let createdInvoiceNumbers: string[] = [];
  let createdDNNumbers: string[] = [];
  let createdSONumbers: string[] = [];
  let discountBatchId: string | undefined;

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `invtestadmin${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('invtestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'Invoice Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'invtestadmin123',
      });
    authToken = loginResponse.body.token;

    // Ensure company settings exist with state matching customer place_of_supply for intra-state GST
    const companySettings = await prisma.companySettings.findFirst();
    const gstState = '24-Gujarat'; // Must match customer place_of_supply for intra-state (CGST+SGST)
    if (!companySettings) {
      await prisma.companySettings.create({
        data: {
          company_name: 'Test Company Ltd',
          address_line1: 'Test Address',
          city: 'Ahmedabad',
          state: gstState,
          pincode: '380001',
          gstin: 'TEST123456789',
          bank_name: 'Test Bank',
          bank_account_number: '1234567890',
          ifsc_code: 'TEST0001234',
          invoice_terms_and_conditions: 'Test terms',
        },
      });
    } else {
      await prisma.companySettings.update({
        where: { id: companySettings.id },
        data: { state: gstState },
      });
    }

    // Create test location (same state for intra-state GST)
    const location = await prisma.location.create({
      data: { city: 'Surat', state: 'Gujarat', pincode: '395001' },
    });
    locationId = location.id;

    // Create test customer
    const customer = await prisma.customer.create({
      data: {
        company_name: 'Invoice Test Customer Ltd',
        contact: '+911234567890',
        email: `invcustomer${timestamp}@test.com`,
        address_line1: 'Test Address',
        location_id: locationId,
        gstin: 'TEST987654321',
        place_of_supply: '24-Gujarat',
        payment_terms: 'Net 30',
        created_by: adminUserId,
      },
    });
    customerId = customer.id;

    // Create test raw material
    const rm = await prisma.rawMaterial.create({
      data: {
        code: `INV-RM-${timestamp}`,
        name: 'Invoice Test Product',
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

    // Create test batch
    const batch = await prisma.rawMaterialBatch.create({
      data: {
        batch_number: `INV-BATCH-${timestamp}`,
        raw_material_id: rawMaterialId,
        quantity_received: 1000,
        quantity_remaining: 1000,
        unit: 'LITER',
        receipt_date: new Date(),
        created_by: adminUserId,
      },
    });
    batchId = batch.id;

    // Create sales order
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

    if (!soResponse.body.salesOrder) {
      console.error('Invoice test: SO creation failed:', soResponse.status, JSON.stringify(soResponse.body));
      throw new Error(`SO creation failed with status ${soResponse.status}: ${JSON.stringify(soResponse.body)}`);
    }
    salesOrderId = soResponse.body.salesOrder.id;
    createdSONumbers.push(soResponse.body.salesOrder.so_number);

    // Create delivery note
    const soItems = await prisma.salesOrderItem.findMany({
      where: { sales_order_id: salesOrderId },
    });

    const dnResponse = await request(API_URL)
      .post('/api/v1/delivery-notes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sales_order_id: salesOrderId,
        delivery_date: '2025-10-25',
        items: [
          {
            sales_order_item_id: soItems[0].id,
            quantity_delivered: 100,
          },
        ],
      });

    deliveryNoteId = dnResponse.body.deliveryNote.id;
    createdDNNumbers.push(dnResponse.body.deliveryNote.dn_number);
  });

  afterAll(async () => {
    try {
      // Clean up in reverse order of creation
      if (createdInvoiceNumbers.length > 0) {
        await prisma.invoiceItem.deleteMany({
          where: { invoice: { invoice_number: { in: createdInvoiceNumbers } } },
        });
        await prisma.invoice.deleteMany({
          where: { invoice_number: { in: createdInvoiceNumbers } },
        });
      }

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
      if (discountBatchId) {
        await prisma.rawMaterialBatch.deleteMany({
          where: { id: discountBatchId },
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

  describe('POST /api/v1/invoices - Create Invoice', () => {
    it('should create an invoice from delivery note with intra-state GST split', async () => {
      const response = await request(API_URL)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          delivery_note_id: deliveryNoteId,
          invoice_date: '2025-10-26',
          payment_terms_days: 30,
        });

      expect(response.status).toBe(201);
      expect(response.body.invoice).toBeDefined();
      expect(response.body.invoice.invoice_number).toMatch(/^INV-\d{4}-\d{3}(-\d+)?$/);

      // Verify GST split (intra-state: CGST + SGST)
      const invoice = response.body.invoice;
      const totalGST = Number(invoice.total_gst);
      const cgst = Number(invoice.cgst_amount);
      const sgst = Number(invoice.sgst_amount);
      const igst = Number(invoice.igst_amount);

      expect(cgst).toBeGreaterThan(0);
      expect(sgst).toBeGreaterThan(0);
      expect(igst).toBe(0);
      expect(cgst).toBe(sgst); // Should be equal for intra-state
      expect(cgst + sgst).toBeCloseTo(totalGST, 2);

      invoiceId = invoice.id;
      createdInvoiceNumbers.push(invoice.invoice_number);
    });

    it('should reject creating invoice for already invoiced delivery note', async () => {
      const response = await request(API_URL)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          delivery_note_id: deliveryNoteId,
          invoice_date: '2025-10-27',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should apply discount correctly', async () => {
      // Create new SO and DN (use separate batch to avoid stock conflicts with prior tests)
      const discountBatch = await prisma.rawMaterialBatch.create({
        data: {
          batch_number: `INV-DISC-${Date.now()}`,
          raw_material_id: rawMaterialId,
          quantity_received: 500,
          quantity_remaining: 500,
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
              batch_id: discountBatch.id,
              quantity: 50,
              unit_price: 200,
              gst_rate: 18,
            },
          ],
        });

      expect(soResponse.status).toBe(201);
      expect(soResponse.body.salesOrder).toBeDefined();
      createdSONumbers.push(soResponse.body.salesOrder.so_number);

      const soItems = await prisma.salesOrderItem.findMany({
        where: { sales_order_id: soResponse.body.salesOrder.id },
      });

      const dnResponse = await request(API_URL)
        .post('/api/v1/delivery-notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sales_order_id: soResponse.body.salesOrder.id,
          delivery_date: '2025-10-25',
          items: [
            {
              sales_order_item_id: soItems[0].id,
            },
          ],
        });

      createdDNNumbers.push(dnResponse.body.deliveryNote.dn_number);

      // Create invoice with discount
      const response = await request(API_URL)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          delivery_note_id: dnResponse.body.deliveryNote.id,
          invoice_date: '2025-10-26',
          discount_percentage: 10, // 10% discount
        });

      expect(response.status).toBe(201);
      const invoice = response.body.invoice;

      // Sub total = 50 * 200 = 10000
      // Discount = 10% of 10000 = 1000
      // Taxable amount = 10000 - 1000 = 9000
      // GST = 18% of 9000 = 1620
      // Grand total = 9000 + 1620 = 10620

      expect(Number(invoice.sub_total)).toBe(10000);
      expect(Number(invoice.discount_amount)).toBe(1000);
      expect(Number(invoice.taxable_amount)).toBe(9000);
      expect(Number(invoice.total_gst)).toBeCloseTo(1620, 2);

      createdInvoiceNumbers.push(invoice.invoice_number);
      discountBatchId = discountBatch.id;
    });

    it('should calculate round-off correctly', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const invoice = response.body.invoice;

      // Grand total should be rounded
      const calculated = Number(invoice.taxable_amount) + Number(invoice.total_gst);
      const grandTotal = Number(invoice.grand_total);
      const roundOff = Number(invoice.round_off);

      expect(grandTotal).toBe(Math.round(calculated));
      expect(roundOff).toBeCloseTo(grandTotal - calculated, 2);
    });
  });

  describe('GET /api/v1/invoices - List Invoices', () => {
    it('should retrieve all invoices with pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter invoices by customer', async () => {
      const response = await request(API_URL)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ customer_id: customerId });

      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      response.body.invoices.forEach((inv: any) => {
        expect(inv.customer_id).toBe(customerId);
      });
    });

    it('should filter invoices by status', async () => {
      const response = await request(API_URL)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'SENT' });

      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      response.body.invoices.forEach((inv: any) => {
        expect(inv.status).toBe('SENT');
      });
    });
  });

  describe('GET /api/v1/invoices/:id - Get Invoice by ID', () => {
    it('should retrieve a specific invoice with all details', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.invoice).toBeDefined();
      expect(response.body.invoice.id).toBe(invoiceId);
      expect(response.body.invoice.customer).toBeDefined();
      expect(response.body.invoice.items).toBeDefined();
      expect(response.body.invoice.sales_order).toBeDefined();
      expect(response.body.invoice.delivery_note).toBeDefined();
    });

    it('should return 404 for non-existent invoice', async () => {
      const response = await request(API_URL)
        .get('/api/v1/invoices/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
