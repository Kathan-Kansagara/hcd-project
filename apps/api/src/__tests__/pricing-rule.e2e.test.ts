import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@zenon/database';

const API_URL = 'http://localhost:3000/api/v1';
let adminToken: string;
let rawMaterialId: string;
let locationId: string;
let customerId: string;
let pricingRuleId: string;

beforeAll(async () => {
  // Login as admin
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@zenon.com',
      password: 'admin123',
    }),
  });
  const loginData = await loginRes.json();
  adminToken = loginData.token;

  const adminUser = (await prisma.user.findFirst({ where: { email: 'admin@zenon.com' } }))!;

  // Create raw material for testing
  const rawMaterial = await prisma.rawMaterial.create({
    data: {
      code: 'RM-TEST-' + Date.now(),
      name: 'Test RM for Pricing ' + Date.now(),
      category: 'Test',
      unit: 'LITER',
      created_by: adminUser.id,
    },
  });
  rawMaterialId = rawMaterial.id;

  // Create test location
  const location = await prisma.location.create({
    data: { city: 'Test City', state: '24-Gujarat', pincode: '123456' },
  });
  locationId = location.id;

  // Create customer for testing
  const ts = Date.now();
  const customer = await prisma.customer.create({
    data: {
      company_name: 'Test Customer for Pricing ' + ts,
      contact: '9876543210',
      email: `testpricing${ts}@example.com`,
      address_line1: 'Test Address',
      location_id: locationId,
      place_of_supply: '24-Gujarat',
      payment_terms: 'Net 30',
      created_by: adminUser.id,
    },
  });
  customerId = customer.id;
});

afterAll(async () => {
  // Clean up pricing rules
  await prisma.pricingRule.deleteMany({
    where: {
      raw_material_id: rawMaterialId,
    },
  });

  // Clean up test data
  if (customerId) {
    await prisma.customer.deleteMany({ where: { id: customerId } });
  }
  if (locationId) {
    await prisma.location.deleteMany({ where: { id: locationId } });
  }

  // Note: Not deleting raw material as it may have foreign key references
  // Set to inactive instead if needed in real scenarios
});

describe('Pricing Rule E2E Tests', () => {
  it('should create a general pricing rule', async () => {
    const res = await fetch(`${API_URL}/pricing-rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        raw_material_id: rawMaterialId,
        unit_price: 100.0,
        effective_from: '2025-01-01',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.pricingRule).toBeDefined();
    expect(data.pricingRule.unit_price).toBe('100');
    expect(data.pricingRule.customer_id).toBeNull();
    pricingRuleId = data.pricingRule.id;
  });

  it('should create a customer-specific pricing rule with quantity range', async () => {
    const res = await fetch(`${API_URL}/pricing-rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        raw_material_id: rawMaterialId,
        customer_id: customerId,
        min_quantity: 100,
        max_quantity: 500,
        unit_price: 90.0,
        effective_from: '2025-01-01',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.pricingRule).toBeDefined();
    expect(data.pricingRule.unit_price).toBe('90');
    expect(data.pricingRule.customer_id).toBe(customerId);
    expect(data.pricingRule.min_quantity).toBe('100');
    expect(data.pricingRule.max_quantity).toBe('500');
  });

  it('should reject pricing rule with invalid quantity range', async () => {
    const res = await fetch(`${API_URL}/pricing-rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        raw_material_id: rawMaterialId,
        min_quantity: 500,
        max_quantity: 100,
        unit_price: 90.0,
        effective_from: '2025-01-01',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('greater than maximum');
  });

  it('should get all pricing rules', async () => {
    const res = await fetch(`${API_URL}/pricing-rules`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pricingRules).toBeDefined();
    expect(Array.isArray(data.pricingRules)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it('should filter pricing rules by raw material', async () => {
    const res = await fetch(`${API_URL}/pricing-rules?raw_material_id=${rawMaterialId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pricingRules.length).toBeGreaterThan(0);
    expect(data.pricingRules[0].raw_material_id).toBe(rawMaterialId);
  });

  it('should filter pricing rules by customer', async () => {
    const res = await fetch(`${API_URL}/pricing-rules?customer_id=${customerId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pricingRules.length).toBeGreaterThan(0);
    expect(data.pricingRules[0].customer_id).toBe(customerId);
  });

  it('should get pricing rule by ID', async () => {
    const res = await fetch(`${API_URL}/pricing-rules/${pricingRuleId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pricingRule).toBeDefined();
    expect(data.pricingRule.id).toBe(pricingRuleId);
  });

  it('should return 404 for non-existent pricing rule', async () => {
    const res = await fetch(`${API_URL}/pricing-rules/00000000-0000-0000-0000-000000000000`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(404);
  });

  it('should update pricing rule', async () => {
    const res = await fetch(`${API_URL}/pricing-rules/${pricingRuleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        unit_price: 110.0,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pricingRule.unit_price).toBe('110');
  });

  it('should calculate price for general customer (no customer-specific rule)', async () => {
    const res = await fetch(
      `${API_URL}/pricing-rules/calculate-price?raw_material_id=${rawMaterialId}&quantity=50&date=2025-06-01`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.unitPrice).toBe(110.0); // Updated price from previous test
    expect(data.totalPrice).toBe(5500.0); // 110 * 50
  });

  it('should calculate price with customer-specific rule and quantity in range', async () => {
    const res = await fetch(
      `${API_URL}/pricing-rules/calculate-price?raw_material_id=${rawMaterialId}&customer_id=${customerId}&quantity=200&date=2025-06-01`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.unitPrice).toBe(90.0); // Customer-specific price
    expect(data.totalPrice).toBe(18000.0); // 90 * 200
  });

  it('should fallback to general pricing when quantity is outside customer-specific range', async () => {
    const res = await fetch(
      `${API_URL}/pricing-rules/calculate-price?raw_material_id=${rawMaterialId}&customer_id=${customerId}&quantity=1000&date=2025-06-01`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.unitPrice).toBe(110.0); // Falls back to general price
    expect(data.totalPrice).toBe(110000.0); // 110 * 1000
  });

  it('should return 404 when no applicable pricing rule exists', async () => {
    const nonExistentRmId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(
      `${API_URL}/pricing-rules/calculate-price?raw_material_id=${nonExistentRmId}&quantity=100`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(res.status).toBe(404);
  });

  it('should delete pricing rule', async () => {
    const res = await fetch(`${API_URL}/pricing-rules/${pricingRuleId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain('deleted successfully');

    // Verify deletion
    const getRes = await fetch(`${API_URL}/pricing-rules/${pricingRuleId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(getRes.status).toBe(404);
  });
});
