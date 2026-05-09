import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Farmers E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let createdFarmerIds: string[] = [];
  const ts = Date.now();
  const adminEmail = `farmertestadmin${ts}@zenon.com`;

  beforeAll(async () => {
    // Create test admin user
    const adminPassword = await bcrypt.hash('farmertestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: adminPassword,
        name: 'Farmer Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: adminEmail,
        password: 'farmertestadmin123',
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    try {
      // Find location IDs of farmers created during tests (before deleting them)
      const farmers = await prisma.farmer.findMany({
        where: { id: { in: createdFarmerIds.filter(Boolean) } },
        select: { location_id: true },
      });
      const locationIds = farmers.map(f => f.location_id).filter(Boolean) as string[];

      // Clean up all created farmers
      await prisma.farmer.deleteMany({
        where: { id: { in: createdFarmerIds.filter(Boolean) } },
      });

      // Clean up locations created by the API
      if (locationIds.length > 0) {
        await prisma.location.deleteMany({
          where: { id: { in: locationIds } },
        });
      }

      await prisma.user.deleteMany({
        where: { id: adminUserId },
      });
    } catch (e) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('POST /api/v1/farmers - Create Farmer', () => {
    it('should create a new farmer with required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/farmers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'John Doe',
          village: 'Test Village',
          contact: '9876543210',
        });

      expect(response.status).toBe(201);
      expect(response.body.farmer).toBeDefined();
      expect(response.body.farmer.name).toBe('John Doe');
      expect(response.body.farmer.village).toBe('Test Village');
      expect(response.body.farmer.contact).toBe('9876543210');
      expect(response.body.farmer.is_archived).toBe(false);

      createdFarmerIds.push(response.body.farmer.id);
    });

    it('should create farmer with all optional fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/farmers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Jane Smith',
          village: 'Green Valley',
          city: 'Mumbai',
          district: 'Mumbai Suburban',
          state: 'Maharashtra',
          pincode: '400070',
          contact: '9876543211',
        });

      expect(response.status).toBe(201);
      expect(response.body.farmer.city).toBe('Mumbai');
      expect(response.body.farmer.district).toBe('Mumbai Suburban');
      expect(response.body.farmer.state).toBe('Maharashtra');
      expect(response.body.farmer.pincode).toBe('400070');

      createdFarmerIds.push(response.body.farmer.id);
    });

    it('should reject farmer creation without required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/farmers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contact: '9876543212',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject farmer creation without authentication', async () => {
      const response = await request(API_URL)
        .post('/api/v1/farmers')
        .send({
          name: 'Test Farmer',
          village: 'Test Village',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/farmers - List Farmers', () => {
    it('should list all farmers', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.farmers).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter farmers by search (village)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers?search=Test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.farmers).toBeInstanceOf(Array);
      if (response.body.farmers.length > 0) {
        response.body.farmers.forEach((farmer: any) => {
          const searchText = 'test';
          const matchesSearch =
            farmer.name?.toLowerCase().includes(searchText) ||
            farmer.village?.toLowerCase().includes(searchText) ||
            farmer.city?.toLowerCase().includes(searchText) ||
            farmer.district?.toLowerCase().includes(searchText) ||
            farmer.state?.toLowerCase().includes(searchText) ||
            farmer.pincode?.includes(searchText) ||
            farmer.contact?.includes(searchText);
          expect(matchesSearch).toBe(true);
        });
      }
    });

    it('should support pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.farmers.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.page).toBe(1);
    });

    it('should exclude archived farmers by default', async () => {
      // First archive a farmer
      const archivedFarmer = createdFarmerIds[1];
      await request(API_URL)
        .post(`/api/v1/farmers/${archivedFarmer}/archive`)
        .set('Authorization', `Bearer ${authToken}`);

      // Get all farmers (should not include archived)
      const response = await request(API_URL)
        .get('/api/v1/farmers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Archived farmer should not be in the list
      const farmerIds = response.body.farmers.map((f: any) => f.id);
      expect(farmerIds).not.toContain(archivedFarmer);

      // Unarchive for other tests
      await request(API_URL)
        .post(`/api/v1/farmers/${archivedFarmer}/unarchive`)
        .set('Authorization', `Bearer ${authToken}`);
    });
  });

  describe('GET /api/v1/farmers/:id - Get Farmer by ID', () => {
    it('should get farmer details by ID', async () => {
      const farmerId = createdFarmerIds[0];
      const response = await request(API_URL)
        .get(`/api/v1/farmers/${farmerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.farmer).toBeDefined();
      expect(response.body.farmer.id).toBe(farmerId);
    });

    it('should return 404 for non-existent farmer', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/farmers/:id - Update Farmer', () => {
    it('should update farmer details', async () => {
      const farmerId = createdFarmerIds[0];
      const response = await request(API_URL)
        .put(`/api/v1/farmers/${farmerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'John Doe Updated',
          city: 'Pune',
          state: 'Maharashtra',
        });

      expect(response.status).toBe(200);
      expect(response.body.farmer.name).toBe('John Doe Updated');
      expect(response.body.farmer.city).toBe('Pune');
      expect(response.body.farmer.state).toBe('Maharashtra');
    });

    it('should return 404 for non-existent farmer', async () => {
      const response = await request(API_URL)
        .put('/api/v1/farmers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/farmers/:id/archive - Archive Farmer', () => {
    it('should archive a farmer', async () => {
      // Create a farmer to archive
      const createResponse = await request(API_URL)
        .post('/api/v1/farmers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'To Be Archived',
          village: 'Archive Village',
        });

      const farmerId = createResponse.body.farmer.id;
      createdFarmerIds.push(farmerId);

      // Archive the farmer
      const response = await request(API_URL)
        .post(`/api/v1/farmers/${farmerId}/archive`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('archived');
      expect(response.body.farmer).toBeDefined();

      // Verify farmer is archived in database
      const archivedFarmer = await prisma.farmer.findUnique({
        where: { id: farmerId },
      });
      expect(archivedFarmer?.is_archived).toBe(true);
      expect(archivedFarmer?.archived_at).toBeDefined();
    });

    it('should return 404 for non-existent farmer', async () => {
      const response = await request(API_URL)
        .post('/api/v1/farmers/00000000-0000-0000-0000-000000000000/archive')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/farmers/locations/:type - Get Location Options', () => {
    it('should get distinct villages', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers/locations/village')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.locations).toBeInstanceOf(Array);
      expect(response.body.locations.length).toBeGreaterThan(0);
    });

    it('should get distinct cities', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers/locations/city')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.locations).toBeInstanceOf(Array);
    });

    it('should reject invalid location type (taluka)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers/locations/taluka')
        .set('Authorization', `Bearer ${authToken}`);

      // taluka is not in the valid location types (village, city, district, state)
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid location type');
    });

    it('should get distinct districts', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers/locations/district')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.locations).toBeInstanceOf(Array);
    });

    it('should get distinct states', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers/locations/state')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.locations).toBeInstanceOf(Array);
    });
  });
});
