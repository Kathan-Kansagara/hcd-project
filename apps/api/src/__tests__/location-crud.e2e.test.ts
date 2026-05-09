import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Location CRUD E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let createdLocationIds: string[] = [];
  let createdFarmerIds: string[] = [];
  const ts = Date.now();

  beforeAll(async () => {
    const testEmail = `locationcrud${ts}@zenon.com`;

    const adminPassword = await bcrypt.hash('locationcrudadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'Location CRUD Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'locationcrudadmin123',
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    try {
      await prisma.farmer.deleteMany({
        where: { id: { in: createdFarmerIds.filter(Boolean) } },
      });
      await prisma.location.deleteMany({
        where: { id: { in: createdLocationIds.filter(Boolean) } },
      });
      await prisma.user.deleteMany({
        where: { id: adminUserId },
      });
    } catch (e) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('Auth required (401 without token)', () => {
    it('should return 401 for GET /api/v1/locations without token', async () => {
      const response = await request(API_URL).get('/api/v1/locations');
      expect(response.status).toBe(401);
    });

    it('should return 401 for POST /api/v1/locations without token', async () => {
      const response = await request(API_URL)
        .post('/api/v1/locations')
        .send({ state: 'Maharashtra' });
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/locations - Create location', () => {
    it('should create a new location', async () => {
      const response = await request(API_URL)
        .post('/api/v1/locations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          village: `Village${ts}`,
          city: `City${ts}`,
          taluka: `Taluka${ts}`,
          district: `District${ts}`,
          state: 'Maharashtra',
          pincode: `4${String(ts).slice(-5)}`,
        });

      expect(response.status).toBe(201);
      expect(response.body.location).toBeDefined();
      expect(response.body.location.village).toBe(`Village${ts}`);
      expect(response.body.location.city).toBe(`City${ts}`);
      expect(response.body.location.taluka).toBe(`Taluka${ts}`);
      expect(response.body.location.district).toBe(`District${ts}`);
      expect(response.body.location.state).toBe('Maharashtra');
      expect(response.body.location.pincode).toBe(`4${String(ts).slice(-5)}`);
      expect(response.body.location.id).toBeDefined();

      createdLocationIds.push(response.body.location.id);
    });

    it('should create location with only required state', async () => {
      const response = await request(API_URL)
        .post('/api/v1/locations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ state: 'Karnataka' });

      expect(response.status).toBe(201);
      expect(response.body.location).toBeDefined();
      expect(response.body.location.state).toBe('Karnataka');
      expect(response.body.location.id).toBeDefined();

      createdLocationIds.push(response.body.location.id);
    });

    it('should reject creation without state', async () => {
      const response = await request(API_URL)
        .post('/api/v1/locations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ village: 'Test', city: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('State');
    });
  });

  describe('GET /api/v1/locations - List with pagination', () => {
    it('should list locations with pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/locations?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.locations).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(0);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.pagination.totalPages).toBeDefined();
      expect(response.body.locations.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/locations - Search filter', () => {
    it('should filter locations by search', async () => {
      const searchTerm = `Village${ts}`;
      const response = await request(API_URL)
        .get(`/api/v1/locations?search=${encodeURIComponent(searchTerm)}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.locations).toBeInstanceOf(Array);
      if (response.body.locations.length > 0) {
        response.body.locations.forEach((loc: { village?: string; city?: string; district?: string; pincode?: string }) => {
          const matches =
            loc.village?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loc.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loc.district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loc.pincode?.includes(searchTerm);
          expect(matches).toBe(true);
        });
      }
    });

    it('should filter by state', async () => {
      const response = await request(API_URL)
        .get('/api/v1/locations?state=Maharashtra')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.locations).toBeInstanceOf(Array);
      response.body.locations.forEach((loc: { state?: string }) => {
        expect(loc.state).toBe('Maharashtra');
      });
    });
  });

  describe('GET /api/v1/locations/:id - Get by ID', () => {
    it('should get location by ID', async () => {
      const locationId = createdLocationIds[0];
      const response = await request(API_URL)
        .get(`/api/v1/locations/${locationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.location).toBeDefined();
      expect(response.body.location.id).toBe(locationId);
      expect(response.body.location.village).toBe(`Village${ts}`);
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(API_URL)
        .get('/api/v1/locations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('not found');
    });
  });

  describe('PUT /api/v1/locations/:id - Update location', () => {
    it('should update location', async () => {
      const locationId = createdLocationIds[0];
      const response = await request(API_URL)
        .put(`/api/v1/locations/${locationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          village: `VillageUpdated${ts}`,
          city: `CityUpdated${ts}`,
          state: 'Gujarat',
        });

      expect(response.status).toBe(200);
      expect(response.body.location).toBeDefined();
      expect(response.body.location.village).toBe(`VillageUpdated${ts}`);
      expect(response.body.location.city).toBe(`CityUpdated${ts}`);
      expect(response.body.location.state).toBe('Gujarat');
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(API_URL)
        .put('/api/v1/locations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ state: 'Maharashtra' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /api/v1/locations/:id - Delete location', () => {
    it('should prevent delete when referenced by farmer', async () => {
      // Create a location for the farmer
      const createLocResponse = await request(API_URL)
        .post('/api/v1/locations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          village: `FarmerRefVillage${ts}`,
          city: `FarmerRefCity${ts}`,
          state: 'Maharashtra',
        });

      expect(createLocResponse.status).toBe(201);
      const locationId = createLocResponse.body.location.id;
      createdLocationIds.push(locationId);

      // Create a farmer referencing this location
      const farmer = await prisma.farmer.create({
        data: {
          name: `FarmerWithLocation${ts}`,
          location_id: locationId,
          created_by: adminUserId,
        },
      });
      createdFarmerIds.push(farmer.id);

      const response = await request(API_URL)
        .delete(`/api/v1/locations/${locationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('farmer');
      expect(response.body.error).toContain('referenced');
    });

    it('should delete location when not referenced', async () => {
      // Use the second location (created with only state) - it should not be referenced
      const locationId = createdLocationIds[1];
      const response = await request(API_URL)
        .delete(`/api/v1/locations/${locationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();
      expect(response.body.message).toContain('deleted');

      // Remove from cleanup list since we deleted it
      const idx = createdLocationIds.indexOf(locationId);
      if (idx >= 0) createdLocationIds.splice(idx, 1);

      // Verify it's gone
      const getResponse = await request(API_URL)
        .get(`/api/v1/locations/${locationId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent ID on delete', async () => {
      const response = await request(API_URL)
        .delete('/api/v1/locations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('not found');
    });
  });
});
