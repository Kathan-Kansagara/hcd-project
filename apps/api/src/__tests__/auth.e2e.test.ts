import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Authentication E2E Tests', () => {
  let adminUserId: string;
  let subadminUserId: string;

  const ts = Date.now();
  const adminEmail = `authtest${ts}@zenon.com`;
  const subadminEmail = `authsub${ts}@zenon.com`;

  beforeAll(async () => {
    // Create test users
    const adminPassword = await bcrypt.hash('authtestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: adminPassword,
        name: 'Auth Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    const subadminPassword = await bcrypt.hash('authtestsubadmin123', 10);
    const subadmin = await prisma.user.create({
      data: {
        email: subadminEmail,
        password_hash: subadminPassword,
        name: 'Auth Test Subadmin',
        role: 'SUBADMIN',
      },
    });
    subadminUserId = subadmin.id;
  });

  afterAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, subadminUserId] } },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/login - User Login', () => {
    it('should login with valid admin credentials', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: adminEmail,
          password: 'authtestadmin123',
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(adminEmail);
      expect(response.body.user.role).toBe('ADMIN');
      expect(response.body.user.password_hash).toBeUndefined(); // Should not return password
    });

    it('should login with valid subadmin credentials', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: subadminEmail,
          password: 'authtestsubadmin123',
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.role).toBe('SUBADMIN');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'authtestadmin@zenon.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.token).toBeUndefined();
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@zenon.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should reject login without email', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject login without password', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'authtestadmin@zenon.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return a valid JWT token', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: adminEmail,
          password: 'authtestadmin123',
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // JWT format
    });
  });

  describe('GET /api/v1/auth/me - Get Current User', () => {
    let authToken: string;

    beforeAll(async () => {
      // Login to get token
      const loginResponse = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: adminEmail,
          password: 'authtestadmin123',
        });
      authToken = loginResponse.body.token;
    });

    it('should return current user details with valid token', async () => {
      const response = await request(API_URL)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(adminEmail);
      expect(response.body.user.name).toBe('Auth Test Admin');
      expect(response.body.user.role).toBe('ADMIN');
      expect(response.body.user.password_hash).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const response = await request(API_URL)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(API_URL)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });

    it('should reject request with malformed authorization header', async () => {
      const response = await request(API_URL)
        .get('/api/v1/auth/me')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
    });
  });

  describe('Protected Routes - Authorization', () => {
    let adminToken: string;
    let subadminToken: string;

    beforeAll(async () => {
      // Get admin token
      const adminLogin = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: adminEmail,
          password: 'authtestadmin123',
        });
      adminToken = adminLogin.body.token;

      // Get subadmin token
      const subadminLogin = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: subadminEmail,
          password: 'authtestsubadmin123',
        });
      subadminToken = subadminLogin.body.token;
    });

    it('should allow admin to access protected routes', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should restrict subadmin from admin-only routes', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers')
        .set('Authorization', `Bearer ${subadminToken}`);

      // SUBADMIN no longer has access to farmers - admin only
      expect(response.status).toBe(403);
    });

    it('should reject access without token', async () => {
      const response = await request(API_URL)
        .get('/api/v1/farmers');

      expect(response.status).toBe(401);
    });

    it('should work with admin token for creating products', async () => {
      const response = await request(API_URL)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Auth Test Product ${Date.now()}`,
          description: 'Testing auth',
        });

      expect(response.status).toBe(201);

      // Clean up
      if (response.body.product) {
        await prisma.product.delete({
          where: { id: response.body.product.id },
        });
      }
    });

    it('should restrict subadmin from creating farmers', async () => {
      const response = await request(API_URL)
        .post('/api/v1/farmers')
        .set('Authorization', `Bearer ${subadminToken}`)
        .send({
          name: `Auth Test Farmer ${Date.now()}`,
          village: 'Test Village',
        });

      // SUBADMIN no longer has access to create farmers - admin only
      expect(response.status).toBe(403);
    });
  });

  describe('Token Expiry and Security', () => {
    it('should include user information in token payload', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: adminEmail,
          password: 'authtestadmin123',
        });

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBeDefined();
      expect(response.body.user.email).toBe(adminEmail);
      expect(response.body.user.role).toBe('ADMIN');
    });

    it('should not return password hash in response', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: adminEmail,
          password: 'authtestadmin123',
        });

      expect(response.status).toBe(200);
      expect(response.body.user.password_hash).toBeUndefined();
      expect(response.body.user.password).toBeUndefined();
    });

    it('should reject reused invalid credentials multiple times', async () => {
      const credentials = {
        email: 'authtestadmin@zenon.com',
        password: 'wrongpassword',
      };

      // First attempt
      const response1 = await request(API_URL)
        .post('/api/v1/auth/login')
        .send(credentials);
      expect(response1.status).toBe(401);

      // Second attempt
      const response2 = await request(API_URL)
        .post('/api/v1/auth/login')
        .send(credentials);
      expect(response2.status).toBe(401);

      // Third attempt
      const response3 = await request(API_URL)
        .post('/api/v1/auth/login')
        .send(credentials);
      expect(response3.status).toBe(401);
    });
  });
});
