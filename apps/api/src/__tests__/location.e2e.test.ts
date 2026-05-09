import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Location API E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    const testEmail = `locationtest${timestamp}@zenon.com`;

    // Create test admin user
    const adminPassword = await bcrypt.hash('locationtestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: adminPassword,
        name: 'Location Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'locationtestadmin123',
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Clean up test user
    await prisma.user.deleteMany({
      where: { id: adminUserId },
    });
    await prisma.$disconnect();
  });

  describe('GET /api/v1/location/pincode/:pincode - Pincode Lookup', () => {
    it('should return location data for valid pincode 110001 (Delhi)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/location/pincode/110001')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.pincode).toBe('110001');
      expect(response.body.district).toBeDefined();
      expect(response.body.state).toBeDefined();
      expect(response.body.state.toLowerCase()).toContain('delhi');
    }, 10000); // Increase timeout for external API call

    it('should return location data for valid pincode 400001 (Mumbai)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/location/pincode/400001')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.pincode).toBe('400001');
      expect(response.body.district).toBeDefined();
      expect(response.body.state).toBeDefined();
      expect(response.body.state.toLowerCase()).toContain('maharashtra');
    }, 10000);

    it('should return 400 for invalid pincode format (less than 6 digits)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/location/pincode/12345')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('Invalid pincode format');
    });

    it('should return 400 for invalid pincode format (more than 6 digits)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/location/pincode/1234567')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('Invalid pincode format');
    });

    it('should return 400 for non-numeric pincode', async () => {
      const response = await request(API_URL)
        .get('/api/v1/location/pincode/ABCDEF')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('Invalid pincode format');
    });

    it('should return 404 for non-existent pincode', async () => {
      const response = await request(API_URL)
        .get('/api/v1/location/pincode/000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('not found');
    }, 10000);

    it('should use cache for repeated pincode lookups', async () => {
      // First call - fetches from API
      const firstResponse = await request(API_URL)
        .get('/api/v1/location/pincode/560001')
        .set('Authorization', `Bearer ${authToken}`);

      expect(firstResponse.status).toBe(200);

      // Second call - should use cache (faster)
      const startTime = Date.now();
      const secondResponse = await request(API_URL)
        .get('/api/v1/location/pincode/560001')
        .set('Authorization', `Bearer ${authToken}`);
      const elapsed = Date.now() - startTime;

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body).toEqual(firstResponse.body);
      expect(elapsed).toBeLessThan(1000); // Cached response should be faster than initial lookup
    }, 15000);

    it('should require authentication', async () => {
      const response = await request(API_URL)
        .get('/api/v1/location/pincode/110001');

      expect(response.status).toBe(401);
    });
  });

  // Cache management endpoints were removed from the location routes
});
