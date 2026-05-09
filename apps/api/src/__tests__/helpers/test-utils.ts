import { PrismaClient } from '@zenon/database';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

export const prisma = new PrismaClient();
export const API_URL = 'http://localhost:3000';

/**
 * Create an admin test user with a timestamped email to avoid collisions.
 * Returns the userId, email, password, and auth token.
 */
export async function createTestAdmin(emailPrefix: string) {
  const timestamp = Date.now();
  const email = `${emailPrefix}${timestamp}@zenon-test.com`;
  const password = `${emailPrefix}pass123`;

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      name: `Test Admin (${emailPrefix})`,
      role: 'ADMIN',
    },
  });

  const loginResponse = await request(API_URL)
    .post('/api/v1/auth/login')
    .send({ email, password });

  return {
    userId: user.id,
    email,
    password,
    token: loginResponse.body.token,
  };
}

/**
 * Create a subadmin test user with a timestamped email.
 */
export async function createTestSubadmin(emailPrefix: string) {
  const timestamp = Date.now();
  const email = `${emailPrefix}${timestamp}@zenon-test.com`;
  const password = `${emailPrefix}pass123`;

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      name: `Test Subadmin (${emailPrefix})`,
      role: 'SUBADMIN',
    },
  });

  const loginResponse = await request(API_URL)
    .post('/api/v1/auth/login')
    .send({ email, password });

  return {
    userId: user.id,
    email,
    password,
    token: loginResponse.body.token,
  };
}

/**
 * Create a test Location record. Returns the full location object.
 */
export async function createTestLocation(overrides?: {
  village?: string;
  city?: string;
  taluka?: string;
  district?: string;
  state?: string;
  pincode?: string;
}) {
  return prisma.location.create({
    data: {
      village: overrides?.village ?? 'Test Village',
      city: overrides?.city ?? 'Test City',
      taluka: overrides?.taluka ?? 'Test Taluka',
      district: overrides?.district ?? 'Test District',
      state: overrides?.state ?? 'Test State',
      pincode: overrides?.pincode ?? '123456',
    },
  });
}

/**
 * Create a test Customer record. Requires a location_id.
 */
export async function createTestCustomer(
  createdBy: string,
  locationId: string,
  overrides?: Partial<{
    company_name: string;
    contact: string;
    email: string;
    address_line1: string;
    gstin: string;
    place_of_supply: string;
    payment_terms: string;
  }>,
) {
  const timestamp = Date.now();
  return prisma.customer.create({
    data: {
      company_name: overrides?.company_name ?? `Test Customer ${timestamp}`,
      contact: overrides?.contact ?? '+911234567890',
      email: overrides?.email ?? `testcust${timestamp}@test.com`,
      address_line1: overrides?.address_line1 ?? 'Test Address Line 1',
      location_id: locationId,
      gstin: overrides?.gstin,
      place_of_supply: overrides?.place_of_supply ?? '24-Gujarat',
      payment_terms: overrides?.payment_terms ?? 'Net 30',
      created_by: createdBy,
    },
  });
}

/**
 * Create a test Supplier record. Requires a location_id.
 */
export async function createTestSupplier(
  createdBy: string,
  locationId: string,
  overrides?: Partial<{
    company_name: string;
    contact: string;
    email: string;
    address_line1: string;
    gstin: string;
    payment_terms: string;
  }>,
) {
  const timestamp = Date.now();
  return prisma.supplier.create({
    data: {
      company_name: overrides?.company_name ?? `Test Supplier ${timestamp}`,
      contact: overrides?.contact ?? '+911234567890',
      email: overrides?.email ?? `testsup${timestamp}@test.com`,
      address_line1: overrides?.address_line1 ?? 'Test Address Line 1',
      location_id: locationId,
      gstin: overrides?.gstin,
      payment_terms: overrides?.payment_terms ?? 'Net 30',
      created_by: createdBy,
    },
  });
}

/**
 * Cleanup helper: deletes a user. Silently ignores errors.
 */
export async function cleanupTestUser(userId: string) {
  try {
    await prisma.user.deleteMany({ where: { id: userId } });
  } catch {
    // ignore
  }
}

/**
 * Cleanup helper: deletes a location. Silently ignores errors.
 */
export async function cleanupTestLocation(locationId: string) {
  try {
    await prisma.location.deleteMany({ where: { id: locationId } });
  } catch {
    // ignore
  }
}
