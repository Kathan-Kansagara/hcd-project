import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Customers & Suppliers E2E Tests', () => {
  let adminToken: string;
  let adminUserId: string;
  let createdCustomerIds: string[] = [];
  let createdSupplierIds: string[] = [];

  beforeAll(async () => {
    // Create test admin user
    const adminPassword = await bcrypt.hash('custsupadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'custsupadmin@zenon.com',
        password_hash: adminPassword,
        name: 'Customer Supplier Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: 'custsupadmin@zenon.com',
        password: 'custsupadmin123',
      });

    adminToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Clean up all created customers and suppliers
    await prisma.customer.deleteMany({
      where: { id: { in: createdCustomerIds } },
    });
    await prisma.supplier.deleteMany({
      where: { id: { in: createdSupplierIds } },
    });
    await prisma.user.deleteMany({
      where: { id: adminUserId },
    });
    await prisma.$disconnect();
  });

  describe('Customer API Tests', () => {
    describe('POST /api/v1/customers - Create Customer', () => {
      it('should create a new customer with all required fields', async () => {
        const response = await request(API_URL)
          .post('/api/v1/customers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            company_name: 'ABC Traders Ltd',
            contact: '9876543210',
            email: 'contact@abctraders.com',
            address_line1: 'Shop No 1, Building A',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            place_of_supply: '27-Maharashtra',
            payment_terms: 'Net 30',
          });

        expect(response.status).toBe(201);
        expect(response.body.customer).toBeDefined();
        expect(response.body.customer.company_name).toBe('ABC Traders Ltd');
        expect(response.body.customer.email).toBe('contact@abctraders.com');
        expect(response.body.customer.is_active).toBe(true);

        createdCustomerIds.push(response.body.customer.id);
      });

      it('should reject customer creation with invalid email format', async () => {
        const response = await request(API_URL)
          .post('/api/v1/customers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            company_name: 'XYZ Corp',
            contact: '9876543211',
            email: 'invalid-email',
            address_line1: 'Building B',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110001',
            place_of_supply: '07-Delhi',
            payment_terms: 'Due on Receipt',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('email');
      });
    });

    describe('GET /api/v1/customers - Get All Customers', () => {
      it('should retrieve all customers with pagination', async () => {
        const response = await request(API_URL)
          .get('/api/v1/customers')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ page: 1, limit: 20 });

        expect(response.status).toBe(200);
        expect(response.body.customers).toBeDefined();
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.total).toBeGreaterThanOrEqual(0);
      });

      it('should search customers by company name', async () => {
        const response = await request(API_URL)
          .get('/api/v1/customers')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ search: 'ABC' });

        expect(response.status).toBe(200);
        expect(response.body.customers).toBeDefined();
      });
    });

    describe('PUT /api/v1/customers/:id - Update Customer', () => {
      it('should update customer details', async () => {
        // First create a customer
        const createResponse = await request(API_URL)
          .post('/api/v1/customers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            company_name: 'Test Update Corp',
            contact: '9999999999',
            email: 'update@test.com',
            address_line1: 'Test Address',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            place_of_supply: '27-Maharashtra',
            payment_terms: 'Net 15',
          });

        const customerId = createResponse.body.customer.id;
        createdCustomerIds.push(customerId);

        // Update the customer
        const updateResponse = await request(API_URL)
          .put(`/api/v1/customers/${customerId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            company_name: 'Updated Corp Name',
            payment_terms: 'Net 45',
          });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.customer.company_name).toBe('Updated Corp Name');
        expect(updateResponse.body.customer.payment_terms).toBe('Net 45');
      });
    });
  });

  describe('Supplier API Tests', () => {
    describe('POST /api/v1/suppliers - Create Supplier', () => {
      it('should create a new supplier with all required fields', async () => {
        const response = await request(API_URL)
          .post('/api/v1/suppliers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            company_name: 'Raw Materials Supplier Ltd',
            contact: '9876543220',
            email: 'sales@rmsupplier.com',
            address_line1: 'Industrial Area, Plot 10',
            city: 'Ahmedabad',
            state: 'Gujarat',
            pincode: '380001',
            payment_terms: 'Net 45',
          });

        expect(response.status).toBe(201);
        expect(response.body.supplier).toBeDefined();
        expect(response.body.supplier.company_name).toBe('Raw Materials Supplier Ltd');
        expect(response.body.supplier.email).toBe('sales@rmsupplier.com');
        expect(response.body.supplier.is_active).toBe(true);

        createdSupplierIds.push(response.body.supplier.id);
      });

      it('should reject supplier creation with invalid email', async () => {
        const response = await request(API_URL)
          .post('/api/v1/suppliers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            company_name: 'Invalid Email Supplier',
            contact: '9876543221',
            email: 'not-an-email',
            address_line1: 'Test Address',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400002',
            payment_terms: 'Net 30',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('email');
      });
    });

    describe('GET /api/v1/suppliers - Get All Suppliers', () => {
      it('should retrieve all suppliers with pagination', async () => {
        const response = await request(API_URL)
          .get('/api/v1/suppliers')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ page: 1, limit: 20 });

        expect(response.status).toBe(200);
        expect(response.body.suppliers).toBeDefined();
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.total).toBeGreaterThanOrEqual(0);
      });
    });

    describe('GET /api/v1/suppliers/:id - Get Supplier by ID', () => {
      it('should retrieve supplier by ID', async () => {
        // First create a supplier
        const createResponse = await request(API_URL)
          .post('/api/v1/suppliers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            company_name: 'Test Supplier for Get',
            contact: '9876543222',
            email: 'get@testsupplier.com',
            address_line1: 'Test Address',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560001',
            payment_terms: 'Net 30',
          });

        const supplierId = createResponse.body.supplier.id;
        createdSupplierIds.push(supplierId);

        // Get the supplier
        const getResponse = await request(API_URL)
          .get(`/api/v1/suppliers/${supplierId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.id).toBe(supplierId);
        expect(getResponse.body.company_name).toBe('Test Supplier for Get');
      });
    });
  });
});
