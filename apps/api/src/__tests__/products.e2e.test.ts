import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

describe('Products E2E Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let createdProductIds: string[] = [];

  beforeAll(async () => {
    // Create test admin user
    const adminPassword = await bcrypt.hash('producttestadmin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'producttestadmin@zenon.com',
        password_hash: adminPassword,
        name: 'Product Test Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    // Login to get auth token
    const loginResponse = await request(API_URL)
      .post('/api/v1/auth/login')
      .send({
        email: 'producttestadmin@zenon.com',
        password: 'producttestadmin123',
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Clean up all created products
    await prisma.product.deleteMany({
      where: { id: { in: createdProductIds } },
    });
    await prisma.user.deleteMany({
      where: { id: adminUserId },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/products - Create Product', () => {
    it('should create a new product with all fields', async () => {
      const response = await request(API_URL)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Product Alpha',
          description: 'A comprehensive test product',
          category: 'Growth Enhancer',
        });

      expect(response.status).toBe(201);
      expect(response.body.product).toBeDefined();
      expect(response.body.product.name).toBe('Test Product Alpha');
      expect(response.body.product.description).toBe('A comprehensive test product');
      expect(response.body.product.category).toBe('Growth Enhancer');

      createdProductIds.push(response.body.product.id);
    });

    it('should create product with only name', async () => {
      const response = await request(API_URL)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Product Beta',
        });

      expect(response.status).toBe(201);
      expect(response.body.product.name).toBe('Test Product Beta');
      expect(response.body.product.description).toBeNull();
      expect(response.body.product.category).toBeNull();

      createdProductIds.push(response.body.product.id);
    });

    it('should reject product creation without name', async () => {
      const response = await request(API_URL)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'No name product',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject duplicate product names', async () => {
      const response = await request(API_URL)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Product Alpha', // Duplicate name
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject product creation without authentication', async () => {
      const response = await request(API_URL)
        .post('/api/v1/products')
        .send({
          name: 'Unauthorized Product',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/products - List Products', () => {
    it('should list all products', async () => {
      const response = await request(API_URL)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.products).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter products by search (name)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/products?search=Alpha')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.products).toBeInstanceOf(Array);
      if (response.body.products.length > 0) {
        response.body.products.forEach((product: any) => {
          expect(product.name.toLowerCase()).toContain('alpha');
        });
      }
    });

    it('should filter products by category', async () => {
      const response = await request(API_URL)
        .get('/api/v1/products?category=Growth Enhancer')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.products.length > 0) {
        response.body.products.forEach((product: any) => {
          expect(product.category).toBe('Growth Enhancer');
        });
      }
    });

    it('should support pagination', async () => {
      const response = await request(API_URL)
        .get('/api/v1/products?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.products.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.page).toBe(1);
    });

    it('should sort products by created_at desc (newest first)', async () => {
      const response = await request(API_URL)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.products.length > 1) {
        const firstProduct = new Date(response.body.products[0].created_at);
        const secondProduct = new Date(response.body.products[1].created_at);
        expect(firstProduct.getTime()).toBeGreaterThanOrEqual(secondProduct.getTime());
      }
    });
  });

  describe('GET /api/v1/products/:id - Get Product by ID', () => {
    it('should get product details by ID', async () => {
      const productId = createdProductIds[0];
      const response = await request(API_URL)
        .get(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.product).toBeDefined();
      expect(response.body.product.id).toBe(productId);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(API_URL)
        .get('/api/v1/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/products/:id - Update Product', () => {
    it('should update product details', async () => {
      const productId = createdProductIds[0];
      const response = await request(API_URL)
        .put(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description',
          category: 'Bloom Enhancer',
        });

      expect(response.status).toBe(200);
      expect(response.body.product.description).toBe('Updated description');
      expect(response.body.product.category).toBe('Bloom Enhancer');
    });

    it('should update product name', async () => {
      const productId = createdProductIds[1];
      const response = await request(API_URL)
        .put(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Product Beta Updated',
        });

      expect(response.status).toBe(200);
      expect(response.body.product.name).toBe('Test Product Beta Updated');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(API_URL)
        .put('/api/v1/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test',
        });

      expect(response.status).toBe(404);
    });

    it('should reject duplicate product name on update', async () => {
      const productId = createdProductIds[1];
      const response = await request(API_URL)
        .put(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Product Alpha', // Name of first product
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('DELETE /api/v1/products/:id - Delete Product', () => {
    it('should delete a product without batches or trials', async () => {
      // Create a product to delete
      const createResponse = await request(API_URL)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'To Be Deleted Product',
          description: 'This product will be deleted',
        });

      const productId = createResponse.body.product.id;
      createdProductIds.push(productId);

      // Delete the product
      const response = await request(API_URL)
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify product is deleted
      const deletedProduct = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(deletedProduct).toBeNull();
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(API_URL)
        .delete('/api/v1/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
