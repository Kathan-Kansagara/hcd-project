import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Trials E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let farmerId: string;
  let locationId: string;
  let productId: string;
  let createdTrialIds: string[] = [];

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `trialtest${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('trialtestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'Trial Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'trialtestadmin123',
      });

    authToken = loginResponse.body.token;

    // Create test location
    const location = await prisma.location.create({
      data: { village: 'Trial Village', state: 'Test State' },
    });
    locationId = location.id;

    // Create test farmer
    const farmer = await prisma.farmer.create({
      data: {
        name: 'Trial Test Farmer',
        location_id: locationId,
        contact: '9999999999',
        created_by: adminUserId,
      },
    });
    farmerId = farmer.id;

    // Create test product
    const product = await prisma.product.create({
      data: {
        name: 'Trial Test Product',
        description: 'Test Product for Trials',
        category: 'Test Category',
        created_by: adminUserId,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    try {
      if (createdTrialIds.length > 0) {
        await prisma.application.deleteMany({ where: { trial_id: { in: createdTrialIds } } });
        await prisma.trial.deleteMany({ where: { id: { in: createdTrialIds } } });
      }
      if (farmerId) await prisma.farmer.deleteMany({ where: { id: farmerId } });
      if (locationId) await prisma.location.deleteMany({ where: { id: locationId } });
      if (productId) await prisma.product.deleteMany({ where: { id: productId } });
      if (adminUserId) await prisma.user.deleteMany({ where: { id: adminUserId } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('POST /api/v1/trials - Create Trial', () => {
    it('should create a new trial with required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/trials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          farmer_id: farmerId,
          product_id: productId,
          crop: 'Wheat',
          village: 'Trial Village',
          start_date: '2025-01-01',
        });

      expect(response.status).toBe(201);
      expect(response.body.trial).toBeDefined();
      expect(response.body.trial.farmer_id).toBe(farmerId);
      expect(response.body.trial.product_id).toBe(productId);
      expect(response.body.trial.crop).toBe('Wheat');
      expect(response.body.trial.status).toBe('DRAFT');

      createdTrialIds.push(response.body.trial.id);
    });

    it('should create trial with all optional fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/trials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          farmer_id: farmerId,
          product_id: productId,
          crop: 'Rice',
          village: 'Trial Village',
          city: 'Mumbai',
          taluka: 'Kurla',
          district: 'Mumbai Suburban',
          state: 'Maharashtra',
          pincode: '400070',
          season: 'Kharif 2025',
          start_date: '2025-06-01',
          status: 'IN_PROGRESS',
          gps_lat: 19.0760,
          gps_lng: 72.8777,
          with_other_products: 'Product X, Product Y',
          yield_value: 50.5,
          yield_unit: 'quintal',
          final_comments: 'Initial trial comments',
        });

      expect(response.status).toBe(201);
      expect(response.body.trial.city).toBe('Mumbai');
      expect(response.body.trial.season).toBe('Kharif 2025');
      expect(response.body.trial.status).toBe('IN_PROGRESS');
      expect(response.body.trial.gps_lat).toBe(19.0760);
      expect(response.body.trial.comments).toBe('Initial trial comments');

      createdTrialIds.push(response.body.trial.id);
    });

    it('should reject trial creation without required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/trials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          crop: 'Wheat',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject trial with non-existent farmer', async () => {
      const response = await request(API_URL)
        .post('/api/v1/trials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          farmer_id: '00000000-0000-0000-0000-000000000000',
          product_id: productId,
          crop: 'Wheat',
          village: 'Test Village',
          start_date: '2025-01-01',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Farmer not found');
    });

    it('should reject trial with non-existent product', async () => {
      const response = await request(API_URL)
        .post('/api/v1/trials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          farmer_id: farmerId,
          product_id: '00000000-0000-0000-0000-000000000000',
          crop: 'Wheat',
          village: 'Test Village',
          start_date: '2025-01-01',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Product not found');
    });
  });

  describe('GET /api/v1/trials - List Trials', () => {
    it('should list all trials', async () => {
      const response = await request(API_URL)
        .get('/api/v1/trials')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.trials).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter trials by farmer_id', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/trials?farmer_id=${farmerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.trials.forEach((trial: any) => {
        expect(trial.farmer_id).toBe(farmerId);
      });
    });

    it('should filter trials by product_id', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/trials?product_id=${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.trials.forEach((trial: any) => {
        expect(trial.product_id).toBe(productId);
      });
    });

    it('should filter trials by status', async () => {
      const response = await request(API_URL)
        .get('/api/v1/trials?status=IN_PROGRESS')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.trials.length > 0) {
        response.body.trials.forEach((trial: any) => {
          expect(trial.status).toBe('IN_PROGRESS');
        });
      }
    });

    it('should filter trials by crop', async () => {
      const response = await request(API_URL)
        .get('/api/v1/trials?crop=Wheat')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.trials.length > 0) {
        response.body.trials.forEach((trial: any) => {
          expect(trial.crop.toLowerCase()).toContain('wheat');
        });
      }
    });

    it('should filter trials by village', async () => {
      const response = await request(API_URL)
        .get('/api/v1/trials?village=Trial')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.trials.length > 0) {
        response.body.trials.forEach((trial: any) => {
          expect(trial.village.toLowerCase()).toContain('trial');
        });
      }
    });

    it('should filter trials by date range', async () => {
      const response = await request(API_URL)
        .get('/api/v1/trials?start_date_from=2025-01-01&start_date_to=2025-12-31')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.trials.length > 0) {
        response.body.trials.forEach((trial: any) => {
          const startDate = new Date(trial.start_date);
          expect(startDate.getFullYear()).toBe(2025);
        });
      }
    });

    it('should support pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/trials?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.trials.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should sort trials by start_date desc (newest first)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/trials')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.trials.length > 1) {
        const firstTrial = new Date(response.body.trials[0].start_date);
        const secondTrial = new Date(response.body.trials[1].start_date);
        expect(firstTrial.getTime()).toBeGreaterThanOrEqual(secondTrial.getTime());
      }
    });
  });

  describe('GET /api/v1/trials/:id - Get Trial by ID', () => {
    it('should get trial details with applications', async () => {
      const trialId = createdTrialIds[0];
      const response = await request(API_URL)
        .get(`/api/v1/trials/${trialId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.trial).toBeDefined();
      expect(response.body.trial.id).toBe(trialId);
      expect(response.body.trial.farmer).toBeDefined();
      expect(response.body.trial.product).toBeDefined();
      expect(response.body.trial.applications).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent trial', async () => {
      const response = await request(API_URL)
        .get('/api/v1/trials/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/trials/:id - Update Trial', () => {
    it('should update trial details', async () => {
      const trialId = createdTrialIds[0];
      const response = await request(API_URL)
        .put(`/api/v1/trials/${trialId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          crop: 'Wheat Updated',
          season: 'Rabi 2025',
          status: 'COMPLETED',
          yield_value: 75.5,
          yield_unit: 'quintal',
          comments: 'Trial completed successfully',
        });

      expect(response.status).toBe(200);
      expect(response.body.trial.crop).toBe('Wheat Updated');
      expect(response.body.trial.season).toBe('Rabi 2025');
      expect(response.body.trial.status).toBe('COMPLETED');
      expect(response.body.trial.yield_value).toBe(75.5);
      expect(response.body.trial.comments).toBe('Trial completed successfully');
    });

    it('should update GPS coordinates', async () => {
      const trialId = createdTrialIds[1];
      const response = await request(API_URL)
        .put(`/api/v1/trials/${trialId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gps_lat: 28.7041,
          gps_lng: 77.1025,
        });

      expect(response.status).toBe(200);
      expect(response.body.trial.gps_lat).toBe(28.7041);
      expect(response.body.trial.gps_lng).toBe(77.1025);
    });

    it('should return 404 for non-existent trial', async () => {
      const response = await request(API_URL)
        .put('/api/v1/trials/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          crop: 'Test',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/trials/:id - Archive Trial', () => {
    it('should archive a trial (soft delete)', async () => {
      // Create a trial to archive
      const createResponse = await request(API_URL)
        .post('/api/v1/trials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          farmer_id: farmerId,
          product_id: productId,
          crop: 'To Be Archived',
          village: 'Archive Village',
          start_date: '2025-01-01',
        });

      const trialId = createResponse.body.trial.id;
      createdTrialIds.push(trialId);

      // Archive the trial via DELETE endpoint
      const response = await request(API_URL)
        .delete(`/api/v1/trials/${trialId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('archived');

      // Verify trial is archived (not deleted)
      const archivedTrial = await prisma.trial.findUnique({
        where: { id: trialId },
      });
      expect(archivedTrial).not.toBeNull();
      expect(archivedTrial?.status).toBe('ARCHIVED');
    });

    it('should return 404 for non-existent trial', async () => {
      const response = await request(API_URL)
        .delete('/api/v1/trials/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/trials/filter-options - Get Filter Options', () => {
    it('should get distinct crops, seasons, and villages', async () => {
      const response = await request(API_URL)
        .get('/api/v1/trials/filter-options')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.crops).toBeInstanceOf(Array);
      expect(response.body.seasons).toBeInstanceOf(Array);
      expect(response.body.villages).toBeInstanceOf(Array);
      expect(response.body.crops.length).toBeGreaterThan(0);
    });
  });
});
