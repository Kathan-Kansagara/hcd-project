import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@zenon.com' },
    update: {},
    create: {
      email: 'admin@zenon.com',
      password_hash: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create subadmin user
  const subadminPassword = await bcrypt.hash('subadmin123', 10);
  const subadmin = await prisma.user.upsert({
    where: { email: 'subadmin@zenon.com' },
    update: {},
    create: {
      email: 'subadmin@zenon.com',
      password_hash: subadminPassword,
      name: 'Sub Admin',
      role: 'SUBADMIN',
    },
  });
  console.log('✅ Subadmin created:', subadmin.email);

  // Create sample products
  const product1 = await prisma.product.upsert({
    where: { name: 'Infi Grow' },
    update: {},
    create: {
      name: 'Infi Grow',
      description: 'Growth enhancer for vegetables',
      category: 'Growth Enhancer',
      created_by: admin.id,
    },
  });

  const product2 = await prisma.product.upsert({
    where: { name: 'Infi Bloom' },
    update: {},
    create: {
      name: 'Infi Bloom',
      description: 'Flowering and fruiting enhancer',
      category: 'Bloom Enhancer',
      created_by: admin.id,
    },
  });
  console.log('✅ Products created:', product1.name, product2.name);

  // Create sample locations
  const location1 = await prisma.location.create({
    data: {
      village: 'Village A',
      city: 'City A',
      district: 'District A',
      state: 'Gujarat',
      pincode: '360001',
    },
  });

  const location2 = await prisma.location.create({
    data: {
      village: 'Village B',
      city: 'City B',
      district: 'District B',
      state: 'Gujarat',
      pincode: '360002',
    },
  });
  console.log('✅ Locations created:', location1.village, location2.village);

  // Create sample farmers
  const farmer1 = await prisma.farmer.create({
    data: {
      name: 'Rajesh Kumar',
      location_id: location1.id,
      contact: '9876543210',
      created_by: subadmin.id,
    },
  });

  const farmer2 = await prisma.farmer.create({
    data: {
      name: 'Suresh Patel',
      location_id: location2.id,
      contact: '9876543211',
      created_by: subadmin.id,
    },
  });
  console.log('✅ Farmers created:', farmer1.name, farmer2.name);

  // Create sample batches
  const batch1 = await prisma.batch.create({
    data: {
      product_id: product2.id,
      batch_number: 'BATCH-2025-001',
      manufacturing_date: new Date('2025-10-01'),
      expiry_date: new Date('2025-11-26'),
      quantity_produced: 100,
      quantity_remaining: 100,
      unit: 'LITER',
      is_active: true,
      created_by: admin.id,
    },
  });
  console.log('✅ Batch created:', batch1.batch_number, 'with', batch1.quantity_remaining, batch1.unit);

  // Create sample trial
  const trial = await prisma.trial.create({
    data: {
      farmer_id: farmer1.id,
      product_id: product1.id,
      location_id: location1.id,
      crop: 'Tomato',
      season: 'Kharif 2025',
      start_date: new Date('2025-01-15'),
      status: 'IN_PROGRESS',
      gps_lat: 28.7041,
      gps_lng: 77.1025,
      comments: 'Initial trial for tomato crop with Infi Grow',
      created_by: subadmin.id,
      applications: {
        create: [
          {
            app_number: 1,
            app_type: 'SPRAY',
            app_date: new Date('2025-01-20'),
            status: 'completed',
            before_comments: 'Plant height: 15cm, Healthy green leaves',
            after_comments: 'After 7 days: Height increased to 25cm, vigorous growth',
            created_by: subadmin.id,
          },
          {
            app_number: 2,
            app_type: 'DRIP',
            app_date: new Date('2025-01-27'),
            status: 'pending',
            before_comments: 'Pre-flowering stage observed',
            created_by: subadmin.id,
          },
        ],
      },
    },
    include: {
      applications: true,
    },
  });
  console.log('✅ Trial created with', trial.applications.length, 'applications');

  // ============================================================================
  // INVENTORY MANAGEMENT SEED DATA
  // ============================================================================

  // Create company settings
  const companySettings = await prisma.companySettings.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      company_name: 'BREWCELL BIOTECH LLP',
      address_line1: 'SHOP NO 10, GAYATRI CHAMBERS',
      address_line2: 'BUS STAND ROAD',
      city: 'GONDAL',
      state: 'Gujarat',
      pincode: '360311',
      gstin: '24AAQFB7049G1ZA',
      fssai_number: 'FSSAI123456',
      bank_name: 'HDFC BANK LTD',
      bank_account_number: '502000-8669-8319',
      ifsc_code: 'HDFC0000550',
      invoice_terms_and_conditions: `1. Our risk and responsibility ceases as soon as the goods leave our premises.
2. Interest @18% p.a. will be charged if payment is not made within due date.
3. Goods once sold will not be taken back.
4. Subject to 'GONDAL' Jurisdiction only. E.&O.E`,
      invoice_prefix: 'GT/',
    },
  });
  console.log('✅ Company settings created:', companySettings.company_name);

  // Create locations for customers
  const customerLocation1 = await prisma.location.create({
    data: {
      city: 'MORBI',
      state: 'Gujarat',
      pincode: '363642',
    },
  });

  const customerLocation2 = await prisma.location.create({
    data: {
      city: 'RAJKOT',
      state: 'Gujarat',
      pincode: '360001',
    },
  });

  // Create sample customers
  const customer1 = await prisma.customer.create({
    data: {
      company_name: 'WELLCROP BIOTECH PRIVATE LIMITED',
      client_name: 'Amit Shah',
      contact: '9876543220',
      email: 'wellcrop@example.com',
      address_line1: 'SURVEY NO 283P1, KHAREDA ROAD',
      address_line2: 'AT VANKADA',
      location_id: customerLocation1.id,
      gstin: '24AABCW5402A1Z1',
      place_of_supply: '24-Gujarat',
      payment_terms: 'Net 30',
      is_active: true,
      created_by: admin.id,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      company_name: 'GREENGROW AGRO INDUSTRIES',
      client_name: 'Rajesh Patel',
      contact: '9876543221',
      email: 'greengrow@example.com',
      address_line1: '45, INDUSTRIAL ESTATE',
      location_id: customerLocation2.id,
      gstin: '24AABCG5402A2Z2',
      place_of_supply: '24-Gujarat',
      payment_terms: 'Net 15',
      is_active: true,
      created_by: admin.id,
    },
  });
  console.log('✅ Customers created:', customer1.company_name, customer2.company_name);

  // Create locations for suppliers
  const supplierLocation1 = await prisma.location.create({
    data: {
      city: 'AHMEDABAD',
      state: 'Gujarat',
      pincode: '380001',
    },
  });

  const supplierLocation2 = await prisma.location.create({
    data: {
      city: 'SURAT',
      state: 'Gujarat',
      pincode: '395001',
    },
  });

  // Create sample suppliers
  const supplier1 = await prisma.supplier.create({
    data: {
      company_name: 'CHEM SUPPLIERS LTD',
      contact_person: 'Suresh Kumar',
      contact: '9876543230',
      email: 'chem@example.com',
      address_line1: '12, CHEMICAL ZONE',
      location_id: supplierLocation1.id,
      gstin: '24AABCS1234A1Z1',
      payment_terms: 'Net 60',
      is_active: true,
      created_by: admin.id,
    },
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      company_name: 'PACKAGING SOLUTIONS PVT LTD',
      contact_person: 'Vikas Mehta',
      contact: '9876543231',
      email: 'packaging@example.com',
      address_line1: '78, PACKAGING STREET',
      location_id: supplierLocation2.id,
      gstin: '24AABCP5678B2Z2',
      payment_terms: 'Net 45',
      is_active: true,
      created_by: admin.id,
    },
  });
  console.log('✅ Suppliers created:', supplier1.company_name, supplier2.company_name);

  // Create sample raw materials with inventory fields
  const rawMaterial1 = await prisma.rawMaterial.create({
    data: {
      code: 'RM-SEED-001',
      name: 'AMINOMIX FEED CONCENTRATE',
      description: 'High-quality amino acid feed concentrate',
      category: 'ACTIVE_INGREDIENT',
      subcategory: 'FEED_ADDITIVES',
      unit: 'KG',
      gst_rate: 5.0,
      hsn_sac_code: '2303',
      default_unit_price: 11.0,
      current_stock_quantity: 5000.0,
      weighted_average_cost: 10.5,
      min_stock_level_inventory: 100.0,
      is_active: true,
      created_by: admin.id,
    },
  });

  const rawMaterial2 = await prisma.rawMaterial.create({
    data: {
      code: 'RM-SEED-002',
      name: 'ORGANIC GROWTH PROMOTER',
      description: 'Natural growth promoter for plants',
      category: 'ACTIVE_INGREDIENT',
      subcategory: 'GROWTH_PROMOTERS',
      unit: 'LITER',
      gst_rate: 12.0,
      hsn_sac_code: '3101',
      default_unit_price: 250.0,
      current_stock_quantity: 200.0,
      weighted_average_cost: 240.0,
      min_stock_level_inventory: 20.0,
      is_active: true,
      created_by: admin.id,
    },
  });
  console.log('✅ Raw materials created:', rawMaterial1.name, rawMaterial2.name);

  console.log('🎉 Seed completed successfully!');
  console.log('\n📧 Login credentials:');
  console.log('Admin: admin@zenon.com / admin123');
  console.log('Subadmin: subadmin@zenon.com / subadmin123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
