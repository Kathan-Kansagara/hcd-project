import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Payment E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let locationId: string;
  let customerId: string;
  let rawMaterialId: string;
  let batchId: string;
  let salesOrderId: string;
  let deliveryNoteId: string;
  let invoiceId: string;
  let paymentId: string;
  let createdPaymentIds: string[] = [];

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `paytestadmin${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('paytestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'Payment Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'paytestadmin123',
      });
    authToken = loginResponse.body.token;

    // Ensure company settings exist
    const companySettings = await prisma.companySettings.findFirst();
    if (!companySettings) {
      await prisma.companySettings.create({
        data: {
          company_name: 'Test Company Ltd',
          address_line1: 'Test Address',
          city: 'Ahmedabad',
          state: '24-Gujarat',
          pincode: '380001',
          gstin: 'TEST123456789',
          bank_name: 'Test Bank',
          bank_account_number: '1234567890',
          ifsc_code: 'TEST0001234',
          invoice_terms_and_conditions: 'Test terms',
        },
      });
    }

    // Create test location
    const location = await prisma.location.create({
      data: { city: 'Surat', state: 'Gujarat', pincode: '395001' },
    });
    locationId = location.id;

    // Create test customer
    const customer = await prisma.customer.create({
      data: {
        company_name: 'Payment Test Customer Ltd',
        contact: '+911234567890',
        email: `paycustomer${timestamp}@test.com`,
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
        code: `PAY-RM-${timestamp}`,
        name: 'Payment Test Product',
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
        batch_number: `PAY-BATCH-${timestamp}`,
        raw_material_id: rawMaterialId,
        quantity_received: 1000,
        quantity_remaining: 1000,
        unit: 'LITER',
        receipt_date: new Date(),
        created_by: adminUserId,
      },
    });
    batchId = batch.id;

    // Create sales order, delivery note, and invoice
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
    salesOrderId = soResponse.body.salesOrder.id;

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

    const invResponse = await request(API_URL)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        delivery_note_id: deliveryNoteId,
        invoice_date: '2025-10-26',
      });
    invoiceId = invResponse.body.invoice.id;
  });

  afterAll(async () => {
    try {
      // Clean up in reverse order
      if (createdPaymentIds.length > 0) {
        await prisma.payment.deleteMany({
          where: { id: { in: createdPaymentIds } },
        });
      }

      if (invoiceId) {
        await prisma.invoiceItem.deleteMany({
          where: { invoice_id: invoiceId },
        });
        await prisma.invoice.deleteMany({
          where: { id: invoiceId },
        });
      }

      await prisma.stockMovement.deleteMany({
        where: { reference_type: 'SalesOrder' },
      });

      if (deliveryNoteId) {
        await prisma.deliveryNoteItem.deleteMany({
          where: { delivery_note_id: deliveryNoteId },
        });
        await prisma.deliveryNote.deleteMany({
          where: { id: deliveryNoteId },
        });
      }

      if (salesOrderId) {
        await prisma.salesOrderItem.deleteMany({
          where: { sales_order_id: salesOrderId },
        });
        await prisma.salesOrder.deleteMany({
          where: { id: salesOrderId },
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

  describe('POST /api/v1/payments - Record Payment', () => {
    it('should record a partial payment and update invoice status to PARTIALLY_PAID', async () => {
      // Get invoice to check grand total
      const invoiceResp = await request(API_URL)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const grandTotal = Number(invoiceResp.body.invoice.grand_total);

      // Pay 50% of the invoice
      const paymentAmount = grandTotal * 0.5;

      const response = await request(API_URL)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoice_id: invoiceId,
          payment_date: '2025-10-28',
          amount: paymentAmount,
          payment_method: 'BANK_TRANSFER',
          reference_number: 'TXN123456',
          notes: 'Partial payment',
        });

      expect(response.status).toBe(201);
      expect(response.body.payment).toBeDefined();
      expect(Number(response.body.payment.amount)).toBe(paymentAmount);
      expect(response.body.invoice.status).toBe('PARTIALLY_PAID');
      expect(Number(response.body.invoice.amount_paid)).toBe(paymentAmount);
      expect(Number(response.body.invoice.amount_due)).toBe(grandTotal - paymentAmount);

      paymentId = response.body.payment.id;
      createdPaymentIds.push(paymentId);
    });

    it('should record a second payment and update invoice status to PAID', async () => {
      // Get current invoice state
      const invoiceResp = await request(API_URL)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const amountDue = Number(invoiceResp.body.invoice.amount_due);

      // Pay remaining amount
      const response = await request(API_URL)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoice_id: invoiceId,
          payment_date: '2025-11-05',
          amount: amountDue,
          payment_method: 'UPI',
          reference_number: 'UPI987654321',
        });

      expect(response.status).toBe(201);
      expect(response.body.invoice.status).toBe('PAID');
      expect(Number(response.body.invoice.amount_due)).toBe(0);

      createdPaymentIds.push(response.body.payment.id);
    });

    it('should reject payment amount exceeding outstanding amount', async () => {
      // Create a new invoice for this test
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
              unit_price: 200,
              gst_rate: 18,
            },
          ],
        });

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

      const invResponse = await request(API_URL)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          delivery_note_id: dnResponse.body.deliveryNote.id,
          invoice_date: '2025-10-26',
        });

      const newInvoiceId = invResponse.body.invoice.id;
      const grandTotal = Number(invResponse.body.invoice.grand_total);

      // Try to pay more than the grand total
      const response = await request(API_URL)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoice_id: newInvoiceId,
          payment_date: '2025-10-28',
          amount: grandTotal + 1000,
          payment_method: 'CASH',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('exceeds outstanding amount');
    });

    it('should reject payment with amount <= 0', async () => {
      const response = await request(API_URL)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoice_id: invoiceId,
          payment_date: '2025-10-28',
          amount: 0,
          payment_method: 'CASH',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('greater than 0');
    });

    it('should reject payment for non-existent invoice', async () => {
      const response = await request(API_URL)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoice_id: '00000000-0000-0000-0000-000000000000',
          payment_date: '2025-10-28',
          amount: 1000,
          payment_method: 'CASH',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Invoice not found');
    });
  });

  describe('GET /api/v1/payments - List Payments', () => {
    it('should retrieve all payments with pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.payments).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(Array.isArray(response.body.payments)).toBe(true);
      expect(response.body.payments.length).toBeGreaterThan(0);
    });

    it('should filter payments by invoice_id', async () => {
      const response = await request(API_URL)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ invoice_id: invoiceId });

      expect(response.status).toBe(200);
      expect(response.body.payments).toBeDefined();
      response.body.payments.forEach((payment: any) => {
        expect(payment.invoice_id).toBe(invoiceId);
      });
    });
  });

  describe('GET /api/v1/payments/:id - Get Payment by ID', () => {
    it('should retrieve a specific payment with all details', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.payment).toBeDefined();
      expect(response.body.payment.id).toBe(paymentId);
      expect(response.body.payment.invoice).toBeDefined();
      expect(response.body.payment.invoice.customer).toBeDefined();
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await request(API_URL)
        .get('/api/v1/payments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/payments/:id - Delete Payment', () => {
    it('should delete payment and update invoice status correctly', async () => {
      // Get current invoice status
      const invoiceBefore = await request(API_URL)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invoiceBefore.body.invoice.status).toBe('PAID');

      // Delete the last payment (which made it fully paid)
      const paymentToDelete = createdPaymentIds[createdPaymentIds.length - 1];
      const response = await request(API_URL)
        .delete(`/api/v1/payments/${paymentToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      // Check invoice status reverted to PARTIALLY_PAID
      const invoiceAfter = await request(API_URL)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invoiceAfter.body.invoice.status).toBe('PARTIALLY_PAID');
      expect(Number(invoiceAfter.body.invoice.amount_due)).toBeGreaterThan(0);

      // Remove from cleanup array since it's deleted
      createdPaymentIds = createdPaymentIds.filter((id) => id !== paymentToDelete);
    });
  });
});
