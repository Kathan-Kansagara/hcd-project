import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Company Settings E2E Tests', () => {
  let adminToken: string;
  let subadminToken: string;
  let adminUserId: string;
  let subadminUserId: string;
  let settingsId: string;

  beforeAll(async () => {
    const ts = Date.now();

    // Create test admin user
    const adminPassword = await bcrypt.hash('settingsadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: `settingsadmin${ts}@zenon.com`,
        password_hash: adminPassword,
        name: 'Settings Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Create test subadmin user
    const subadminPassword = await bcrypt.hash('settingssubadmin123', 10);
    const subadmin = await prisma.user.create({
      data: {
        email: `settingssubadmin${ts}@zenon.com`,
        password_hash: subadminPassword,
        name: 'Settings Test Subadmin',
        role: 'SUBADMIN',
      },
    });
    subadminUserId = subadmin.id;

    // Login as admin
    const adminLoginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `settingsadmin${ts}@zenon.com`,
        password: 'settingsadmin123',
      });
    adminToken = adminLoginResponse.body.token;

    // Login as subadmin
    const subadminLoginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `settingssubadmin${ts}@zenon.com`,
        password: 'settingssubadmin123',
      });
    subadminToken = subadminLoginResponse.body.token;

    // Create initial company settings
    const settings = await prisma.companySettings.create({
      data: {
        company_name: 'Test Company Ltd',
        address_line1: 'Shop No 1, Test Building',
        address_line2: 'Test Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        gstin: '27AABCT1332L1ZV',
        fssai_number: '12345678901234',
        bank_name: 'Test Bank',
        bank_account_number: '1234567890',
        ifsc_code: 'TEST0001234',
        invoice_terms_and_conditions: 'Test Terms and Conditions',
        invoice_prefix: 'TEST/',
      },
    });
    settingsId = settings.id;
  });

  afterAll(async () => {
    try {
      await prisma.companySettings.deleteMany({
        where: { id: settingsId },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [adminUserId, subadminUserId].filter(Boolean) } },
      });
    } catch (e) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('GET /api/v1/company-settings - Get Company Settings', () => {
    it('should retrieve company settings for authenticated user', async () => {
      const response = await request(API_URL)
        .get('/api/v1/company-settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      // Check that settings exist with expected structure (values may vary due to test order)
      expect(response.body.company_name).toBeDefined();
      expect(response.body.gstin).toBeDefined();
      expect(response.body.bank_name).toBeDefined();
      expect(response.body.ifsc_code).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const response = await request(API_URL).get('/api/v1/company-settings');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/company-settings - Update Company Settings', () => {
    it('should update company settings as ADMIN', async () => {
      const response = await request(API_URL)
        .put('/api/v1/company-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          company_name: 'Updated Test Company Ltd',
          address_line1: 'Shop No 2, Updated Building',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411001',
          gstin: '27AABCT1332L1ZW',
          bank_name: 'Updated Bank',
          bank_account_number: '9876543210',
          ifsc_code: 'UPDT0001234',
          invoice_prefix: 'UPD/',
        });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.company_name).toBe('Updated Test Company Ltd');
      expect(response.body.city).toBe('Pune');
      expect(response.body.gstin).toBe('27AABCT1332L1ZW');
      expect(response.body.bank_name).toBe('Updated Bank');
      expect(response.body.invoice_prefix).toBe('UPD/');
    });

    it('should reject update from SUBADMIN (not authorized)', async () => {
      const response = await request(API_URL)
        .put('/api/v1/company-settings')
        .set('Authorization', `Bearer ${subadminToken}`)
        .send({
          company_name: 'Unauthorized Update',
        });

      expect(response.status).toBe(403);
    });

    it('should reject update with missing required fields', async () => {
      const response = await request(API_URL)
        .put('/api/v1/company-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          company_name: '', // Empty required field
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject update with invalid GSTIN format', async () => {
      const response = await request(API_URL)
        .put('/api/v1/company-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gstin: 'INVALID_GSTIN',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('GSTIN');
    });

    it('should reject update with invalid IFSC code format', async () => {
      const response = await request(API_URL)
        .put('/api/v1/company-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ifsc_code: 'INVALID',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('IFSC');
    });
  });
});
