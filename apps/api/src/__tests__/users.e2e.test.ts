import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Users E2E Tests', () => {
  let adminToken: string;
  let adminUserId: string;
  let subadminToken: string;
  let subadminUserId: string;
  const createdUserIds: string[] = [];
  const ts = Date.now();
  const adminEmail = `usertestadmin${ts}@zenon-test.com`;
  const subadminEmail = `usertestsubadmin${ts}@zenon-test.com`;

  beforeAll(async () => {
    // Create admin user for testing
    const adminPasswordHash = await bcrypt.hash('adminpass123', 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: adminPasswordHash,
        name: 'User Test Admin',
        role: 'ADMIN',
        permissions: ['dashboard:view', 'users:view', 'users:create', 'users:update', 'users:delete', 'users:manage'],
      },
    });
    adminUserId = admin.id;

    const adminLogin = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'adminpass123' });
    adminToken = adminLogin.body.token;

    // Create subadmin user for permission testing
    const subadminPasswordHash = await bcrypt.hash('subadminpass123', 10);
    const subadmin = await prisma.user.create({
      data: {
        email: subadminEmail,
        password_hash: subadminPasswordHash,
        name: 'User Test Subadmin',
        role: 'SUBADMIN',
        permissions: ['dashboard:view'],
      },
    });
    subadminUserId = subadmin.id;

    const subadminLogin = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({ email: subadminEmail, password: 'subadminpass123' });
    subadminToken = subadminLogin.body.token;
  });

  afterAll(async () => {
    try {
      // Clean up all created users
      const allIds = [...createdUserIds, adminUserId, subadminUserId].filter(Boolean);
      await prisma.user.deleteMany({
        where: { id: { in: allIds } },
      });
    } catch {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  // ─── GET /api/v1/users ───────────────────────────────────────────────

  describe('GET /api/v1/users - List Users', () => {
    it('should list users with pagination as admin', async () => {
      const response = await request(API_URL)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
      expect(response.body.pagination.page).toBe(1);
    });

    it('should support search filter', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/users?search=User Test Admin`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeGreaterThanOrEqual(1);
      expect(response.body.users.some((u: any) => u.email === adminEmail)).toBe(true);
    });

    it('should support pagination parameters', async () => {
      const response = await request(API_URL)
        .get('/api/v1/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should support sorting', async () => {
      const response = await request(API_URL)
        .get('/api/v1/users?sortBy=name&sortOrder=asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeInstanceOf(Array);
    });

    it('should deny access for non-admin users', async () => {
      const response = await request(API_URL)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${subadminToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny access without authentication', async () => {
      const response = await request(API_URL)
        .get('/api/v1/users');

      expect(response.status).toBe(401);
    });

    it('should return permissions as an array for all users', async () => {
      const response = await request(API_URL)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.users.forEach((user: any) => {
        expect(Array.isArray(user.permissions)).toBe(true);
      });
    });
  });

  // ─── GET /api/v1/users/:id ──────────────────────────────────────────

  describe('GET /api/v1/users/:id - Get User By ID', () => {
    it('should get user details by ID as admin', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/users/${subadminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(subadminUserId);
      expect(response.body.user.email).toBe(subadminEmail);
      expect(response.body.user.name).toBe('User Test Subadmin');
      expect(response.body.user.role).toBe('SUBADMIN');
    });

    it('should return permissions as an array', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/users/${subadminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.user.permissions)).toBe(true);
      expect(response.body.user.permissions).toContain('dashboard:view');
    });

    it('should deny subadmin without users:view from accessing user details', async () => {
      // Subadmin only has dashboard:view, not users:view
      const response = await request(API_URL)
        .get(`/api/v1/users/${subadminUserId}`)
        .set('Authorization', `Bearer ${subadminToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow subadmin with users:view to access user details', async () => {
      // Create a subadmin with users:view permission
      const passwordHash = await bcrypt.hash('viewerpass123', 10);
      const viewer = await prisma.user.create({
        data: {
          email: `viewer${ts}@zenon-test.com`,
          password_hash: passwordHash,
          name: 'Viewer Subadmin',
          role: 'SUBADMIN',
          permissions: ['dashboard:view', 'users:view'],
        },
      });
      createdUserIds.push(viewer.id);

      const loginResponse = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({ email: `viewer${ts}@zenon-test.com`, password: 'viewerpass123' });

      const viewerToken = loginResponse.body.token;

      const response = await request(API_URL)
        .get(`/api/v1/users/${viewer.id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(viewer.id);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(API_URL)
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should not expose password_hash in response', async () => {
      const response = await request(API_URL)
        .get(`/api/v1/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.password_hash).toBeUndefined();
      expect(response.body.user.password).toBeUndefined();
    });
  });

  // ─── POST /api/v1/users ─────────────────────────────────────────────

  describe('POST /api/v1/users - Create User', () => {
    it('should create a new ADMIN user', async () => {
      const response = await request(API_URL)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `newadmin${ts}@zenon-test.com`,
          password: 'newadmin123',
          name: 'New Admin User',
          role: 'ADMIN',
          permissions: [],
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(`newadmin${ts}@zenon-test.com`);
      expect(response.body.user.name).toBe('New Admin User');
      expect(response.body.user.role).toBe('ADMIN');
      expect(Array.isArray(response.body.user.permissions)).toBe(true);
      createdUserIds.push(response.body.user.id);
    });

    it('should create a SUBADMIN user with permissions', async () => {
      const permissions = [
        'dashboard:view',
        'farmers:view',
        'farmers:create',
        'farmers:update',
        'farmers:delete',
        'products:view',
      ];

      const response = await request(API_URL)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `newsubadmin${ts}@zenon-test.com`,
          password: 'newsubadmin123',
          name: 'New Subadmin User',
          role: 'SUBADMIN',
          permissions,
        });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('SUBADMIN');
      expect(Array.isArray(response.body.user.permissions)).toBe(true);
      expect(response.body.user.permissions).toEqual(expect.arrayContaining(permissions));
      expect(response.body.user.permissions.length).toBe(permissions.length);
      createdUserIds.push(response.body.user.id);
    });

    it('should create a SUBADMIN user without explicit permissions (defaults to empty array)', async () => {
      const response = await request(API_URL)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `noperm${ts}@zenon-test.com`,
          password: 'noperm123',
          name: 'No Perm User',
          role: 'SUBADMIN',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('SUBADMIN');
      expect(Array.isArray(response.body.user.permissions)).toBe(true);
      expect(response.body.user.permissions).toEqual([]);
      createdUserIds.push(response.body.user.id);
    });

    it('should reject creation with duplicate email', async () => {
      const response = await request(API_URL)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: adminEmail,
          password: 'duplicate123',
          name: 'Duplicate User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject creation without required fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `missing${ts}@zenon-test.com`,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should deny creation for non-admin users', async () => {
      const response = await request(API_URL)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${subadminToken}`)
        .send({
          email: `denied${ts}@zenon-test.com`,
          password: 'denied123',
          name: 'Denied User',
        });

      expect(response.status).toBe(403);
    });

    it('should deny creation without authentication', async () => {
      const response = await request(API_URL)
        .post('/api/v1/users')
        .send({
          email: `noauth${ts}@zenon-test.com`,
          password: 'noauth123',
          name: 'No Auth User',
        });

      expect(response.status).toBe(401);
    });
  });

  // ─── PUT /api/v1/users/:id ──────────────────────────────────────────

  describe('PUT /api/v1/users/:id - Update User', () => {
    let userToUpdateId: string;

    beforeAll(async () => {
      // Create a user to update in tests
      const passwordHash = await bcrypt.hash('updateme123', 10);
      const user = await prisma.user.create({
        data: {
          email: `updatetarget${ts}@zenon-test.com`,
          password_hash: passwordHash,
          name: 'Update Target',
          role: 'SUBADMIN',
          permissions: ['dashboard:view', 'farmers:view'],
        },
      });
      userToUpdateId = user.id;
      createdUserIds.push(user.id);
    });

    it('should update user name', async () => {
      const response = await request(API_URL)
        .put(`/api/v1/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.user.name).toBe('Updated Name');
    });

    it('should update user email', async () => {
      const newEmail = `updated${ts}@zenon-test.com`;
      const response = await request(API_URL)
        .put(`/api/v1/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: newEmail });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe(newEmail);
    });

    it('should update user role', async () => {
      const response = await request(API_URL)
        .put(`/api/v1/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ADMIN' });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('ADMIN');

      // Revert role for further tests
      await request(API_URL)
        .put(`/api/v1/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'SUBADMIN' });
    });

    it('should update user permissions', async () => {
      const newPermissions = [
        'dashboard:view',
        'farmers:view',
        'farmers:create',
        'products:view',
        'products:create',
      ];

      const response = await request(API_URL)
        .put(`/api/v1/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: newPermissions });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.user.permissions)).toBe(true);
      expect(response.body.user.permissions).toEqual(expect.arrayContaining(newPermissions));
      expect(response.body.user.permissions.length).toBe(newPermissions.length);
    });

    it('should return permissions as array after update', async () => {
      // Verify via GET that the permissions persisted correctly
      const response = await request(API_URL)
        .get(`/api/v1/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.user.permissions)).toBe(true);
      expect(response.body.user.permissions).toContain('dashboard:view');
      expect(response.body.user.permissions).toContain('farmers:view');
      expect(response.body.user.permissions).toContain('products:view');
    });

    it('should update password without returning it', async () => {
      const response = await request(API_URL)
        .put(`/api/v1/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(response.body.user.password_hash).toBeUndefined();
      expect(response.body.user.password).toBeUndefined();
    });

    it('should not send password when it is empty (edit mode)', async () => {
      // Simulates the frontend behavior: editing without changing password
      const response = await request(API_URL)
        .put(`/api/v1/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No Password Change' });

      expect(response.status).toBe(200);
      expect(response.body.user.name).toBe('No Password Change');
    });

    it('should deny role change for non-admin users', async () => {
      const response = await request(API_URL)
        .put(`/api/v1/users/${subadminUserId}`)
        .set('Authorization', `Bearer ${subadminToken}`)
        .send({ role: 'ADMIN' });

      expect(response.status).toBe(403);
    });
  });

  // ─── DELETE /api/v1/users/:id ───────────────────────────────────────

  describe('DELETE /api/v1/users/:id - Delete User', () => {
    let userToDeleteId: string;

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash('deleteme123', 10);
      const user = await prisma.user.create({
        data: {
          email: `deletetarget${ts}@zenon-test.com`,
          password_hash: passwordHash,
          name: 'Delete Target',
          role: 'SUBADMIN',
          permissions: [],
        },
      });
      userToDeleteId = user.id;
    });

    it('should delete a user as admin', async () => {
      const response = await request(API_URL)
        .delete(`/api/v1/users/${userToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify user is actually deleted
      const deletedUser = await prisma.user.findUnique({
        where: { id: userToDeleteId },
      });
      expect(deletedUser).toBeNull();
    });

    it('should prevent admin from deleting themselves', async () => {
      const response = await request(API_URL)
        .delete(`/api/v1/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot delete your own account');
    });

    it('should deny deletion for non-admin users', async () => {
      const response = await request(API_URL)
        .delete(`/api/v1/users/${adminUserId}`)
        .set('Authorization', `Bearer ${subadminToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny deletion without authentication', async () => {
      const response = await request(API_URL)
        .delete(`/api/v1/users/${adminUserId}`);

      expect(response.status).toBe(401);
    });
  });

  // ─── Permissions normalization (bug fix verification) ───────────────

  describe('Permissions normalization', () => {
    it('should normalize legacy {} permissions to empty array on list', async () => {
      // Create a user with permissions stored as {} (simulating legacy data)
      const passwordHash = await bcrypt.hash('legacypass123', 10);
      const legacyUser = await prisma.user.create({
        data: {
          email: `legacyperms${ts}@zenon-test.com`,
          password_hash: passwordHash,
          name: 'Legacy Perms User',
          role: 'SUBADMIN',
          permissions: {}, // Legacy format: empty object instead of array
        },
      });
      createdUserIds.push(legacyUser.id);

      // List endpoint should return permissions as an array
      const listResponse = await request(API_URL)
        .get(`/api/v1/users?search=legacyperms${ts}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listResponse.status).toBe(200);
      const found = listResponse.body.users.find((u: any) => u.id === legacyUser.id);
      expect(found).toBeDefined();
      expect(Array.isArray(found.permissions)).toBe(true);
      expect(found.permissions).toEqual([]);
    });

    it('should normalize legacy {} permissions to empty array on getById', async () => {
      // Create another user with {} permissions
      const passwordHash = await bcrypt.hash('legacypass456', 10);
      const legacyUser = await prisma.user.create({
        data: {
          email: `legacyget${ts}@zenon-test.com`,
          password_hash: passwordHash,
          name: 'Legacy Get User',
          role: 'SUBADMIN',
          permissions: {},
        },
      });
      createdUserIds.push(legacyUser.id);

      // getById should also return permissions as array
      const getResponse = await request(API_URL)
        .get(`/api/v1/users/${legacyUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(200);
      expect(Array.isArray(getResponse.body.user.permissions)).toBe(true);
      expect(getResponse.body.user.permissions).toEqual([]);
    });

    it('should normalize null permissions to empty array', async () => {
      // Directly set permissions to null via Prisma
      const passwordHash = await bcrypt.hash('nullpermpass', 10);
      const nullPermUser = await prisma.user.create({
        data: {
          email: `nullperm${ts}@zenon-test.com`,
          password_hash: passwordHash,
          name: 'Null Perm User',
          role: 'SUBADMIN',
          permissions: undefined, // Will use schema default
        },
      });
      createdUserIds.push(nullPermUser.id);

      const response = await request(API_URL)
        .get(`/api/v1/users/${nullPermUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.user.permissions)).toBe(true);
    });

    it('should preserve valid permissions array through create and get cycle', async () => {
      const permissions = [
        'dashboard:view',
        'farmers:view',
        'farmers:create',
        'farmers:update',
        'farmers:delete',
        'products:view',
        'trials:view',
      ];

      // Create user with specific permissions
      const createResponse = await request(API_URL)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `roundtrip${ts}@zenon-test.com`,
          password: 'roundtrip123',
          name: 'Round Trip User',
          role: 'SUBADMIN',
          permissions,
        });

      expect(createResponse.status).toBe(201);
      createdUserIds.push(createResponse.body.user.id);

      // Fetch the same user and verify permissions match
      const getResponse = await request(API_URL)
        .get(`/api/v1/users/${createResponse.body.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(200);
      expect(Array.isArray(getResponse.body.user.permissions)).toBe(true);
      expect(getResponse.body.user.permissions).toEqual(expect.arrayContaining(permissions));
      expect(getResponse.body.user.permissions.length).toBe(permissions.length);
    });

    it('should preserve valid permissions through update and get cycle', async () => {
      // Create a user first
      const createResponse = await request(API_URL)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `updatert${ts}@zenon-test.com`,
          password: 'updatert123',
          name: 'Update RT User',
          role: 'SUBADMIN',
          permissions: ['dashboard:view'],
        });

      expect(createResponse.status).toBe(201);
      const userId = createResponse.body.user.id;
      createdUserIds.push(userId);

      // Update with new permissions
      const updatedPermissions = [
        'dashboard:view',
        'farmers:view',
        'farmers:create',
        'customers:view',
        'customers:create',
        'customers:update',
      ];

      const updateResponse = await request(API_URL)
        .put(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: updatedPermissions });

      expect(updateResponse.status).toBe(200);

      // Fetch and verify
      const getResponse = await request(API_URL)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(200);
      expect(Array.isArray(getResponse.body.user.permissions)).toBe(true);
      expect(getResponse.body.user.permissions).toEqual(expect.arrayContaining(updatedPermissions));
      expect(getResponse.body.user.permissions.length).toBe(updatedPermissions.length);
    });
  });
});
