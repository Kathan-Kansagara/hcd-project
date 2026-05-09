import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Dashboard Stats E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let farmerId: string;
  let locationId: string;
  let productId: string;
  let batchId: string;
  let trial1Id: string;
  let trial2Id: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `statstest${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('statstestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'Stats Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'statstestadmin123',
      });

    authToken = loginResponse.body.token;

    // Create test location
    const location = await prisma.location.create({
      data: { village: 'Stats Village', state: 'Test State' },
    });
    locationId = location.id;

    // Create test data
    const farmer = await prisma.farmer.create({
      data: {
        name: 'Stats Test Farmer',
        location_id: locationId,
        created_by: adminUserId,
      },
    });
    farmerId = farmer.id;

    const product = await prisma.product.create({
      data: {
        name: 'Stats Test Product',
        created_by: adminUserId,
      },
    });
    productId = product.id;

    // Create batch with 100 liters, use 10 liters
    const batch = await prisma.batch.create({
      data: {
        product_id: productId,
        batch_number: 'STATS-BATCH-001',
        manufacturing_date: new Date('2025-10-01'),
        expiry_date: new Date('2025-11-30'), // Expiring soon (within 30 days)
        quantity_produced: 100,
        quantity_remaining: 90, // 10% used
        unit: 'LITER',
        is_active: true,
        created_by: adminUserId,
      },
    });
    batchId = batch.id;

    // Create trials with different statuses
    const trial1 = await prisma.trial.create({
      data: {
        farmer_id: farmerId,
        product_id: productId,
        crop: 'Test Crop 1',
        location_id: locationId,
        start_date: new Date('2025-01-01'),
        status: 'IN_PROGRESS',
        created_by: adminUserId,
      },
    });
    trial1Id = trial1.id;

    const trial2 = await prisma.trial.create({
      data: {
        farmer_id: farmerId,
        product_id: productId,
        crop: 'Test Crop 2',
        location_id: locationId,
        start_date: new Date('2025-01-15'),
        status: 'COMPLETED',
        created_by: adminUserId,
      },
    });
    trial2Id = trial2.id;
  });

  afterAll(async () => {
    try {
      await prisma.trial.deleteMany({
        where: { id: { in: [trial1Id, trial2Id].filter(Boolean) } },
      });
      if (batchId) await prisma.batch.deleteMany({ where: { id: batchId } });
      if (farmerId) await prisma.farmer.deleteMany({ where: { id: farmerId } });
      if (locationId) await prisma.location.deleteMany({ where: { id: locationId } });
      if (productId) await prisma.product.deleteMany({ where: { id: productId } });
      if (adminUserId) await prisma.user.deleteMany({ where: { id: adminUserId } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('GET /api/v1/dashboard/stats - Get Dashboard Statistics', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(API_URL)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Controller returns camelCase keys
      expect(response.body.totalTrials).toBeGreaterThanOrEqual(2);
      expect(response.body.completedTrials).toBeGreaterThanOrEqual(1);
      expect(response.body.inProgressTrials).toBeGreaterThanOrEqual(1);
    });

    it('should reject request without authentication', async () => {
      const response = await request(API_URL)
        .get('/api/v1/dashboard/stats');

      expect(response.status).toBe(401);
    });
  });
});
