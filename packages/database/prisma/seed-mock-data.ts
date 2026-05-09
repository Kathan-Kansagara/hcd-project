import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================================================
// DATA ARRAYS
// ============================================================================

const FARMER_NAMES = [
  'Mahesh Sharma', 'Ramesh Singh', 'Dinesh Patel', 'Vijay Kumar', 'Anil Sharma',
  'Mukesh Verma', 'Sanjay Patel', 'Ashok Kumar', 'Bharat Shah', 'Chirag Patel',
  'Devendra Singh', 'Prakash Yadav', 'Govind Sharma', 'Hitesh Patel', 'Jagdish Kumar',
  'Kiran Patel', 'Lalit Sharma', 'Manish Singh', 'Nilesh Patel', 'Paresh Kumar',
  'Rohit Sharma', 'Sunil Patel', 'Tushar Kumar', 'Umesh Singh', 'Vinod Patel',
  'Yogesh Kumar', 'Ajay Patel', 'Bhavesh Shah', 'Chandresh Kumar', 'Dharmesh Patel',
  'Ganesh Sharma', 'Harish Kumar', 'Jayesh Patel', 'Kailash Singh', 'Lokesh Kumar',
  'Mahendra Patel', 'Naresh Sharma', 'Pradeep Kumar', 'Rajiv Patel', 'Satish Kumar',
  'Tarun Patel', 'Vivek Sharma', 'Deepak Kumar', 'Gaurav Patel', 'Hemant Sharma',
  'Kishore Kumar', 'Mohan Patel', 'Nitin Sharma',
];

const VILLAGES = [
  'Dhoraji', 'Jetpur', 'Upleta', 'Keshod', 'Veraval', 'Porbandar',
  'Surendranagar', 'Amreli', 'Botad', 'Jasdan', 'Vinchhiya', 'Paddhari',
  'Lodhika', 'Kalavad', 'Dhrol', 'Dwarka', 'Okha', 'Dhari',
  'Mahuva', 'Talaja', 'Palitana', 'Una', 'Kodinar', 'Mangrol',
  'Visavadar', 'Kutiyana', 'Ranavav', 'Manavadar', 'Vanthali', 'Mendarda',
  'Bantva', 'Maliya', 'Babra', 'Savarkundla', 'Lathi', 'Gadhada',
  'Vallabhipur', 'Sihor', 'Gariadhar', 'Rajula',
];

const CITIES = [
  'Rajkot', 'Ahmedabad', 'Vadodara', 'Surat', 'Jamnagar', 'Junagadh',
  'Bhavnagar', 'Gandhinagar', 'Morbi', 'Porbandar', 'Anand', 'Bharuch',
  'Navsari', 'Mehsana', 'Patan',
];

const DISTRICTS = [
  'Rajkot', 'Junagadh', 'Bhavnagar', 'Amreli', 'Morbi', 'Jamnagar',
  'Porbandar', 'Surendranagar', 'Botad', 'Gir Somnath',
];

const PINCODES = [
  '360001', '360002', '360003', '360004', '360005', '360311', '360330',
  '360370', '360410', '360440', '360450', '360460', '360470', '360480',
  '360490', '362001', '362002', '362130', '362150', '362220', '362230',
  '362240', '362250', '362260', '362265', '362530', '362550', '362560',
  '363001', '363002', '363310', '363320', '363330', '363421', '363642',
  '364001', '364002', '364003', '364265', '364270',
];

const PRODUCT_NAMES = [
  'Infi Shield', 'Infi Root', 'Infi Green', 'Infi Max', 'Infi Plus',
  'Infi Pro', 'Infi Vita', 'Infi Care', 'Infi Force', 'Infi Gold',
];

const PRODUCT_CATEGORIES = [
  'Growth Enhancer', 'Root Stimulator', 'Foliar Spray', 'Soil Conditioner',
  'Bio Stimulant', 'Nutrient Supplement',
];

const RAW_MATERIAL_DATA = [
  { name: 'AMINO ACID POWDER', cat: 'ACTIVE_INGREDIENT', sub: 'AMINO_ACIDS', unit: 'KG', gst: 5, hsn: '2922', price: 450 },
  { name: 'HUMIC ACID GRANULES', cat: 'ACTIVE_INGREDIENT', sub: 'HUMIC_SUBSTANCES', unit: 'KG', gst: 5, hsn: '3824', price: 180 },
  { name: 'SEAWEED EXTRACT LIQUID', cat: 'ACTIVE_INGREDIENT', sub: 'PLANT_EXTRACTS', unit: 'LITER', gst: 12, hsn: '1302', price: 320 },
  { name: 'FULVIC ACID SOLUTION', cat: 'ACTIVE_INGREDIENT', sub: 'HUMIC_SUBSTANCES', unit: 'LITER', gst: 12, hsn: '3824', price: 280 },
  { name: 'POTASSIUM HUMATE', cat: 'ACTIVE_INGREDIENT', sub: 'HUMIC_SUBSTANCES', unit: 'KG', gst: 5, hsn: '3824', price: 220 },
  { name: 'ZINC SULPHATE MONOHYDRATE', cat: 'ACTIVE_INGREDIENT', sub: 'MICRO_NUTRIENTS', unit: 'KG', gst: 5, hsn: '2833', price: 95 },
  { name: 'BORON 20% POWDER', cat: 'ACTIVE_INGREDIENT', sub: 'MICRO_NUTRIENTS', unit: 'KG', gst: 5, hsn: '2810', price: 340 },
  { name: 'CALCIUM NITRATE', cat: 'ACTIVE_INGREDIENT', sub: 'MACRO_NUTRIENTS', unit: 'KG', gst: 5, hsn: '2834', price: 42 },
  { name: 'MAGNESIUM SULPHATE', cat: 'ACTIVE_INGREDIENT', sub: 'MACRO_NUTRIENTS', unit: 'KG', gst: 5, hsn: '2833', price: 28 },
  { name: 'FERROUS SULPHATE', cat: 'ACTIVE_INGREDIENT', sub: 'MICRO_NUTRIENTS', unit: 'KG', gst: 5, hsn: '2833', price: 35 },
  { name: 'MANGANESE SULPHATE', cat: 'ACTIVE_INGREDIENT', sub: 'MICRO_NUTRIENTS', unit: 'KG', gst: 5, hsn: '2833', price: 75 },
  { name: 'COPPER SULPHATE', cat: 'ACTIVE_INGREDIENT', sub: 'MICRO_NUTRIENTS', unit: 'KG', gst: 5, hsn: '2833', price: 420 },
  { name: 'CITRIC ACID MONOHYDRATE', cat: 'EXCIPIENT', sub: 'ACIDIFIERS', unit: 'KG', gst: 18, hsn: '2918', price: 85 },
  { name: 'EDTA CHELATE MIX', cat: 'EXCIPIENT', sub: 'CHELATING_AGENTS', unit: 'KG', gst: 18, hsn: '2921', price: 520 },
  { name: 'NEEM OIL TECHNICAL GRADE', cat: 'ACTIVE_INGREDIENT', sub: 'PLANT_EXTRACTS', unit: 'LITER', gst: 5, hsn: '1515', price: 380 },
  { name: 'HDPE BOTTLE 500ML', cat: 'PACKAGING', sub: 'BOTTLES', unit: 'PIECE', gst: 18, hsn: '3923', price: 8.5 },
  { name: 'HDPE BOTTLE 1L', cat: 'PACKAGING', sub: 'BOTTLES', unit: 'PIECE', gst: 18, hsn: '3923', price: 12 },
  { name: 'HDPE BOTTLE 250ML', cat: 'PACKAGING', sub: 'BOTTLES', unit: 'PIECE', gst: 18, hsn: '3923', price: 6.5 },
  { name: 'CAP SEAL 38MM', cat: 'PACKAGING', sub: 'CLOSURES', unit: 'PIECE', gst: 18, hsn: '3923', price: 2.5 },
  { name: 'FRONT LABEL STICKER', cat: 'PACKAGING', sub: 'LABELS', unit: 'PIECE', gst: 18, hsn: '4821', price: 1.8 },
  { name: 'BACK LABEL STICKER', cat: 'PACKAGING', sub: 'LABELS', unit: 'PIECE', gst: 18, hsn: '4821', price: 1.5 },
  { name: 'CARTON BOX 12PK', cat: 'PACKAGING', sub: 'CARTONS', unit: 'PIECE', gst: 18, hsn: '4819', price: 35 },
  { name: 'SHRINK WRAP FILM', cat: 'PACKAGING', sub: 'WRAPPING', unit: 'KG', gst: 18, hsn: '3920', price: 180 },
];

const CUSTOMER_NAMES = [
  'AGRI BIOTECH PVT LTD', 'KRISHI SOLUTIONS INDIA', 'FARM CARE ENTERPRISES',
  'CROP TECH INDUSTRIES', 'GREEN HARVEST AGRO', 'BIO GROW TECHNOLOGIES',
  'PLANT HEALTH SCIENCES', 'SEED MASTER CORPORATION', 'AGRI KING PRODUCTS',
  'NATURAL FARM INPUTS', 'ORGANIC SOLUTIONS LTD', 'FIELD FORCE AGRI',
  'HARVEST GOLD INDUSTRIES', 'CROP CARE CHEMICALS', 'BIO SHIELD AGROCHEMICALS',
  'TERRA AGRI SCIENCES', 'KISAN AGRI INPUTS', 'SHREE RAM AGRO',
  'JAI KISHAN TRADERS', 'PATEL AGRI PRODUCTS', 'KRISHNA AGRO INDUSTRIES',
  'ANAND AGRI SERVICES', 'DHARTI AGRO CHEMICALS', 'SHAKTI AGRI SOLUTIONS',
  'BHARAT AGRI INPUTS', 'GOLDEN CROP SCIENCE', 'TULSI AGRI ENTERPRISES',
  'MAHAVIR AGRO PRODUCTS',
];

const SUPPLIER_NAMES = [
  'BIO CHEM SUPPLIERS LTD', 'PACKAGING WORLD PVT LTD', 'RAW MATERIALS INDIA CO',
  'AGRI INPUTS WHOLESALE', 'CHEMICAL WAREHOUSE LTD', 'ORGANIC SUPPLY CO PVT',
  'NUTRIENT SOURCE LTD', 'ECO PACK SOLUTIONS', 'QUALITY CHEMICALS INC',
  'GREEN PACKAGING PVT', 'MICRO NUTRIENTS INDIA', 'AMINO ACID SUPPLIERS CO',
  'GROWTH PROMOTER MFG', 'SOIL HEALTH SOLUTIONS', 'BIO ENZYME FACTORY',
  'AGRI CHEM DISTRIBUTORS', 'INDIA PACKING CORP', 'NATIONAL RAW SUPPLIES',
];

const CROPS = ['Tomato', 'Cotton', 'Groundnut', 'Wheat', 'Rice', 'Mango', 'Banana', 'Onion', 'Potato', 'Chili', 'Garlic', 'Turmeric', 'Ginger', 'Sugarcane', 'Cumin', 'Fennel', 'Soybean', 'Maize', 'Pearl Millet', 'Okra'];
const SEASONS = ['Kharif 2024', 'Rabi 2024-25', 'Kharif 2025', 'Rabi 2025-26', 'Summer 2025'];
const TRIAL_STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'] as const;
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CREDIT_CARD'] as const;

// ============================================================================
// HELPERS
// ============================================================================

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomPhone(): string {
  return `98${randomInt(10000000, 99999999)}`;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('🌱 Starting mock data seed...');

  // Get existing admin user
  const admin = await prisma.user.findUnique({ where: { email: 'admin@zenon.com' } });
  if (!admin) {
    console.error('❌ Admin user not found. Run the base seed first: pnpm db:seed');
    process.exit(1);
  }

  // ================================================================
  // 1. ADDITIONAL USERS
  // ================================================================
  console.log('👤 Creating users...');
  const pw = await bcrypt.hash('user123', 10);
  const newUsers = [];
  for (const u of [
    { email: 'field@zenon.com', name: 'Field Agent', role: 'SUBADMIN' as const },
    { email: 'manager@zenon.com', name: 'Production Manager', role: 'SUBADMIN' as const },
    { email: 'operator@zenon.com', name: 'Lab Operator', role: 'SUBADMIN' as const },
  ]) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, password_hash: pw, name: u.name, role: u.role },
    });
    newUsers.push(user);
  }
  const allUsers = [admin, ...newUsers];
  console.log(`  ✅ ${allUsers.length} total users`);

  // ================================================================
  // 2. LOCATIONS (for farmers)
  // ================================================================
  console.log('📍 Creating locations...');
  const farmerLocations = [];
  for (let i = 0; i < 40; i++) {
    const loc = await prisma.location.create({
      data: {
        village: VILLAGES[i % VILLAGES.length],
        city: CITIES[i % CITIES.length],
        district: DISTRICTS[i % DISTRICTS.length],
        state: 'Gujarat',
        pincode: PINCODES[i % PINCODES.length],
      },
    });
    farmerLocations.push(loc);
  }
  console.log(`  ✅ ${farmerLocations.length} farmer locations`);

  // ================================================================
  // 3. FARMERS
  // ================================================================
  console.log('👨‍🌾 Creating farmers...');
  const farmers = [];
  for (let i = 0; i < FARMER_NAMES.length; i++) {
    const f = await prisma.farmer.create({
      data: {
        name: FARMER_NAMES[i],
        contact: randomPhone(),
        location_id: farmerLocations[i % farmerLocations.length].id,
        created_by: allUsers[i % allUsers.length].id,
      },
    });
    farmers.push(f);
  }
  console.log(`  ✅ ${farmers.length} farmers`);

  // ================================================================
  // 4. PRODUCTS
  // ================================================================
  console.log('📦 Creating products...');
  const products = [];
  for (let i = 0; i < PRODUCT_NAMES.length; i++) {
    const p = await prisma.product.upsert({
      where: { name: PRODUCT_NAMES[i] },
      update: {},
      create: {
        name: PRODUCT_NAMES[i],
        description: `${PRODUCT_NAMES[i]} - Premium agricultural ${PRODUCT_CATEGORIES[i % PRODUCT_CATEGORIES.length].toLowerCase()}`,
        category: PRODUCT_CATEGORIES[i % PRODUCT_CATEGORIES.length],
        created_by: admin.id,
      },
    });
    products.push(p);
  }
  // Also get existing products
  const existingProducts = await prisma.product.findMany();
  const allProducts = existingProducts;
  console.log(`  ✅ ${allProducts.length} total products`);

  // ================================================================
  // 5. RAW MATERIALS
  // ================================================================
  console.log('🧪 Creating raw materials...');
  const rawMaterials = [];
  for (let i = 0; i < RAW_MATERIAL_DATA.length; i++) {
    const rm = RAW_MATERIAL_DATA[i];
    const code = `RM-${pad(i + 10, 4)}`;
    try {
      const created = await prisma.rawMaterial.create({
        data: {
          code,
          name: rm.name,
          description: `${rm.name} - Grade A quality`,
          category: rm.cat,
          subcategory: rm.sub,
          unit: rm.unit as any,
          gst_rate: rm.gst,
          hsn_sac_code: rm.hsn,
          default_unit_price: rm.price,
          current_stock_quantity: randomFloat(100, 5000),
          weighted_average_cost: rm.price * randomFloat(0.9, 1.1),
          min_stock_level_inventory: randomFloat(20, 200),
          is_active: true,
          created_by: admin.id,
        },
      });
      rawMaterials.push(created);
    } catch {
      // Skip if code already exists
    }
  }
  const allRawMaterials = await prisma.rawMaterial.findMany();
  console.log(`  ✅ ${allRawMaterials.length} total raw materials`);

  // ================================================================
  // 6. PRODUCT BATCHES
  // ================================================================
  console.log('🏭 Creating product batches...');
  const batches = [];
  for (let i = 0; i < 35; i++) {
    const product = allProducts[i % allProducts.length];
    const mfgDate = randomDate(new Date('2024-06-01'), new Date('2025-12-01'));
    const expDate = new Date(mfgDate.getTime() + randomInt(180, 730) * 86400000);
    const qty = randomFloat(50, 500, 0);
    const batchNumber = `BATCH-${mfgDate.getFullYear()}-${pad(i + 10, 3)}`;
    try {
      const b = await prisma.batch.create({
        data: {
          product_id: product.id,
          batch_number: batchNumber,
          manufacturing_date: mfgDate,
          expiry_date: expDate,
          quantity_produced: qty,
          quantity_remaining: randomFloat(0, qty),
          unit: pick(['LITER', 'KG']) as any,
          storage_location: pick(['Warehouse A', 'Warehouse B', 'Cold Storage', 'Main Store', 'Production Floor']),
          notes: `Production batch for ${product.name}`,
          is_active: Math.random() > 0.1,
          created_by: pick(allUsers).id,
        },
      });
      batches.push(b);
    } catch {
      // Skip duplicates
    }
  }
  console.log(`  ✅ ${batches.length} product batches`);

  // ================================================================
  // 7. RAW MATERIAL BATCHES
  // ================================================================
  console.log('📋 Creating RM batches...');
  const rmBatches = [];
  for (let i = 0; i < 45; i++) {
    const rm = allRawMaterials[i % allRawMaterials.length];
    const receiptDate = randomDate(new Date('2024-06-01'), new Date('2025-12-01'));
    const expDate = new Date(receiptDate.getTime() + randomInt(365, 1095) * 86400000);
    const qty = randomFloat(50, 2000);
    const batchNum = `RMB-${receiptDate.getFullYear()}-${pad(i + 10, 3)}`;
    try {
      const b = await prisma.rawMaterialBatch.create({
        data: {
          raw_material_id: rm.id,
          batch_number: batchNum,
          receipt_date: receiptDate,
          expiry_date: expDate,
          quantity_received: qty,
          quantity_remaining: randomFloat(10, qty),
          unit: rm.unit as any,
          storage_location: pick(['Warehouse A', 'Warehouse B', 'Cold Storage', 'Chemical Store', 'Packaging Store']),
          quality_status: pick(['APPROVED', 'APPROVED', 'APPROVED', 'PENDING', 'REJECTED']),
          is_active: Math.random() > 0.05,
          created_by: pick(allUsers).id,
        },
      });
      rmBatches.push(b);
    } catch {
      // Skip duplicates
    }
  }
  console.log(`  ✅ ${rmBatches.length} RM batches`);

  // ================================================================
  // 8. BOM ITEMS
  // ================================================================
  console.log('📝 Creating BOM items...');
  let bomCount = 0;
  for (let p = 0; p < Math.min(allProducts.length, 8); p++) {
    const product = allProducts[p];
    const rmsForBom = pickN(allRawMaterials, randomInt(2, 4));
    for (const rm of rmsForBom) {
      try {
        await prisma.billOfMaterialItem.create({
          data: {
            product_id: product.id,
            raw_material_id: rm.id,
            quantity_per_unit: randomFloat(0.01, 2.0, 3),
            unit: rm.unit as any,
            notes: `${rm.name} required per unit of ${product.name}`,
            created_by: admin.id,
          },
        });
        bomCount++;
      } catch {
        // Skip duplicate product-rm combinations
      }
    }
  }
  console.log(`  ✅ ${bomCount} BOM items`);

  // ================================================================
  // 9. CUSTOMERS
  // ================================================================
  console.log('🏢 Creating customers...');
  const customers = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const city = CITIES[i % CITIES.length];
    const loc = await prisma.location.create({
      data: { city, state: 'Gujarat', pincode: PINCODES[i % PINCODES.length] },
    });
    const c = await prisma.customer.create({
      data: {
        company_name: CUSTOMER_NAMES[i],
        client_name: FARMER_NAMES[i % FARMER_NAMES.length].split(' ')[0] + ' ' + pick(['Shah', 'Patel', 'Mehta', 'Joshi', 'Desai']),
        contact: randomPhone(),
        email: CUSTOMER_NAMES[i].toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) + `${i}@example.com`,
        address_line1: `${randomInt(1, 500)}, ${pick(['INDUSTRIAL ESTATE', 'GIDC', 'MARKET YARD', 'MAIN ROAD', 'STATION ROAD'])}`,
        location_id: loc.id,
        gstin: `24${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 1) % 26))}${String.fromCharCode(65 + ((i + 2) % 26))}${String.fromCharCode(65 + ((i + 3) % 26))}${String.fromCharCode(65 + ((i + 4) % 26))}${pad(randomInt(1000, 9999), 4)}${String.fromCharCode(65 + (i % 26))}1Z${i % 10}`,
        place_of_supply: '24-Gujarat',
        payment_terms: pick(['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Advance']),
        is_active: Math.random() > 0.1,
        created_by: admin.id,
      },
    });
    customers.push(c);
  }
  const allCustomers = await prisma.customer.findMany();
  console.log(`  ✅ ${allCustomers.length} total customers`);

  // ================================================================
  // 10. SUPPLIERS
  // ================================================================
  console.log('🏪 Creating suppliers...');
  const suppliers = [];
  for (let i = 0; i < SUPPLIER_NAMES.length; i++) {
    const city = CITIES[i % CITIES.length];
    const loc = await prisma.location.create({
      data: { city, state: 'Gujarat', pincode: PINCODES[(i + 15) % PINCODES.length] },
    });
    const s = await prisma.supplier.create({
      data: {
        company_name: SUPPLIER_NAMES[i],
        contact_person: FARMER_NAMES[(i + 20) % FARMER_NAMES.length],
        contact: randomPhone(),
        email: SUPPLIER_NAMES[i].toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) + `${i}@supplier.com`,
        address_line1: `${randomInt(1, 300)}, ${pick(['CHEMICAL ZONE', 'INDUSTRIAL AREA', 'WAREHOUSE DISTRICT', 'TRADING COMPLEX'])}`,
        location_id: loc.id,
        gstin: `24${String.fromCharCode(65 + ((i + 5) % 26))}${String.fromCharCode(65 + ((i + 6) % 26))}${String.fromCharCode(65 + ((i + 7) % 26))}${String.fromCharCode(65 + ((i + 8) % 26))}${String.fromCharCode(65 + ((i + 9) % 26))}${pad(randomInt(1000, 9999), 4)}${String.fromCharCode(65 + (i % 26))}1Z${(i + 5) % 10}`,
        payment_terms: pick(['Net 30', 'Net 45', 'Net 60', 'Net 90']),
        is_active: Math.random() > 0.05,
        created_by: admin.id,
      },
    });
    suppliers.push(s);
  }
  const allSuppliers = await prisma.supplier.findMany();
  console.log(`  ✅ ${allSuppliers.length} total suppliers`);

  // ================================================================
  // 11. PURCHASE ORDERS
  // ================================================================
  console.log('🛒 Creating purchase orders...');
  const purchaseOrders = [];
  for (let i = 0; i < 35; i++) {
    const supplier = allSuppliers[i % allSuppliers.length];
    const orderDate = randomDate(new Date('2024-07-01'), new Date('2025-11-30'));
    const year = orderDate.getFullYear();
    const poNum = `PO-${year}-${pad(i + 10, 3)}`;
    const itemCount = randomInt(1, 3);
    const selectedRMs = pickN(allRawMaterials, itemCount);

    const items = selectedRMs.map(rm => {
      const qty = randomFloat(10, 500);
      const price = Number(rm.default_unit_price || 100);
      return {
        raw_material_id: rm.id,
        quantity: qty,
        unit: rm.unit,
        unit_price: price,
        total_price: parseFloat((qty * price).toFixed(2)),
      };
    });

    try {
      const po = await prisma.purchaseOrder.create({
        data: {
          po_number: poNum,
          supplier_id: supplier.id,
          order_date: orderDate,
          expected_delivery_date: new Date(orderDate.getTime() + randomInt(7, 45) * 86400000),
          status: pick(['PENDING', 'PENDING', 'RECEIVED', 'RECEIVED', 'RECEIVED', 'CANCELLED']) as any,
          notes: Math.random() > 0.5 ? `Order for ${selectedRMs[0].name}` : null,
          created_by: pick(allUsers).id,
          items: { create: items },
        },
      });
      purchaseOrders.push(po);
    } catch {
      // Skip duplicates
    }
  }
  console.log(`  ✅ ${purchaseOrders.length} purchase orders`);

  // ================================================================
  // 12. TRIALS
  // ================================================================
  console.log('🔬 Creating trials...');
  const trials = [];
  for (let i = 0; i < 40; i++) {
    const farmer = farmers[i % farmers.length];
    const product = allProducts[i % allProducts.length];
    const location = farmerLocations[i % farmerLocations.length];
    const startDate = randomDate(new Date('2024-06-01'), new Date('2025-10-01'));
    const status = pick(TRIAL_STATUSES);

    const t = await prisma.trial.create({
      data: {
        farmer_id: farmer.id,
        product_id: product.id,
        location_id: location.id,
        crop: pick(CROPS),
        season: pick(SEASONS),
        start_date: startDate,
        status,
        gps_lat: randomFloat(20.5, 24.5, 4),
        gps_lng: randomFloat(69.0, 73.0, 4),
        comments: `Trial of ${product.name} on ${pick(CROPS)} crop`,
        rating: status === 'COMPLETED' ? randomFloat(1, 5, 1) : null,
        is_successful: status === 'COMPLETED' ? Math.random() > 0.3 : null,
        created_by: pick(allUsers).id,
        applications: {
          create: Array.from({ length: randomInt(1, 3) }, (_, j) => ({
            app_number: j + 1,
            app_type: pick(['SPRAY', 'DRIP', 'IRRIGATION']) as any,
            app_date: new Date(startDate.getTime() + (j + 1) * 7 * 86400000),
            status: j === 0 ? 'completed' : pick(['pending', 'completed']),
            before_comments: `Application ${j + 1} pre-treatment observation`,
            after_comments: j === 0 ? `Application ${j + 1} post-treatment: visible improvement` : null,
            created_by: pick(allUsers).id,
          })),
        },
      },
    });
    trials.push(t);
  }
  console.log(`  ✅ ${trials.length} trials`);

  // ================================================================
  // 13. SALES ORDERS
  // ================================================================
  console.log('💰 Creating sales orders...');
  const salesOrders = [];
  const approvedBatches = rmBatches.filter(b => b.quantity_remaining > 10);

  for (let i = 0; i < 30; i++) {
    const customer = allCustomers[i % allCustomers.length];
    const orderDate = randomDate(new Date('2024-08-01'), new Date('2025-11-30'));
    const year = orderDate.getFullYear();
    const soNum = `SO-${year}-${pad(i + 10, 3)}`;
    const itemCount = randomInt(1, 3);
    const selectedBatches = pickN(approvedBatches, itemCount);

    const items = [];
    for (const batch of selectedBatches) {
      const rm = allRawMaterials.find(r => r.id === batch.raw_material_id);
      if (!rm) continue;
      const qty = randomFloat(5, Math.min(50, batch.quantity_remaining));
      const unitPrice = Number(rm.default_unit_price || 100);
      const gstRate = Number(rm.gst_rate);
      const amount = parseFloat((qty * unitPrice).toFixed(2));
      const gstAmount = parseFloat((amount * gstRate / 100).toFixed(2));

      items.push({
        raw_material_id: rm.id,
        batch_id: batch.id,
        product_name: rm.name,
        hsn_sac_code: rm.hsn_sac_code || '0000',
        quantity: qty,
        unit: rm.unit,
        unit_price: unitPrice,
        gst_rate: gstRate,
        amount,
        gst_amount: gstAmount,
        total_amount: parseFloat((amount + gstAmount).toFixed(2)),
      });
    }

    if (items.length === 0) continue;

    try {
      const so = await prisma.salesOrder.create({
        data: {
          so_number: soNum,
          customer_id: customer.id,
          order_date: orderDate,
          expected_delivery_date: new Date(orderDate.getTime() + randomInt(3, 30) * 86400000),
          status: pick(['PENDING', 'PENDING', 'DELIVERED', 'DELIVERED', 'INVOICED', 'PAID', 'CANCELLED']) as any,
          discount_amount: 0,
          discount_percentage: 0,
          notes: Math.random() > 0.6 ? `Order for ${items[0].product_name}` : null,
          created_by: pick(allUsers).id,
          items: { create: items },
        },
      });
      salesOrders.push(so);
    } catch {
      // Skip duplicates
    }
  }
  console.log(`  ✅ ${salesOrders.length} sales orders`);

  // ================================================================
  // 14. INVOICES
  // ================================================================
  console.log('🧾 Creating invoices...');
  const invoices = [];
  const soForInvoice = salesOrders.slice(0, 25);

  for (let i = 0; i < soForInvoice.length; i++) {
    const so = soForInvoice[i];
    // Get SO items
    const soItems = await prisma.salesOrderItem.findMany({
      where: { sales_order_id: so.id },
      include: { raw_material: true },
    });

    if (soItems.length === 0) continue;

    const customer = allCustomers.find(c => c.id === so.customer_id);
    if (!customer) continue;

    const invoiceDate = new Date(so.order_date.getTime() + randomInt(1, 14) * 86400000);
    const year = invoiceDate.getFullYear();
    const invNum = `INV-${year}-${pad(i + 10, 3)}`;

    // Calculate invoice amounts
    const invoiceItems = soItems.map((item, idx) => {
      const amount = Number(item.amount);
      const gstRate = Number(item.gst_rate);
      const gstAmount = amount * gstRate / 100;
      return {
        sr_no: idx + 1,
        product_name: item.product_name,
        hsn_sac_code: item.hsn_sac_code,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.unit_price,
        gst_rate: gstRate,
        amount,
        cgst_amount: parseFloat((gstAmount / 2).toFixed(2)),
        sgst_amount: parseFloat((gstAmount / 2).toFixed(2)),
        igst_amount: 0,
      };
    });

    const subTotal = invoiceItems.reduce((s, it) => s + it.amount, 0);
    const totalCgst = invoiceItems.reduce((s, it) => s + it.cgst_amount, 0);
    const totalSgst = invoiceItems.reduce((s, it) => s + it.sgst_amount, 0);
    const totalGst = totalCgst + totalSgst;
    const grandTotal = Math.round(subTotal + totalGst);
    const roundOff = grandTotal - (subTotal + totalGst);

    const invoiceStatus = pick(['SENT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']) as any;
    const amountPaid = invoiceStatus === 'PAID' ? grandTotal : invoiceStatus === 'PARTIALLY_PAID' ? Math.round(grandTotal * randomFloat(0.2, 0.8)) : 0;

    try {
      const inv = await prisma.invoice.create({
        data: {
          invoice_number: invNum,
          sales_order_id: so.id,
          customer_id: customer.id,
          invoice_date: invoiceDate,
          due_date: new Date(invoiceDate.getTime() + 30 * 86400000),
          place_of_supply: '24-Gujarat',
          sub_total: subTotal,
          discount_amount: 0,
          taxable_amount: subTotal,
          cgst_amount: totalCgst,
          sgst_amount: totalSgst,
          igst_amount: 0,
          total_gst: totalGst,
          round_off: roundOff,
          grand_total: grandTotal,
          amount_paid: amountPaid,
          amount_due: grandTotal - amountPaid,
          status: invoiceStatus,
          created_by: pick(allUsers).id,
          items: { create: invoiceItems },
        },
      });
      invoices.push(inv);
    } catch {
      // Skip duplicates
    }
  }
  console.log(`  ✅ ${invoices.length} invoices`);

  // ================================================================
  // 15. PAYMENTS
  // ================================================================
  console.log('💳 Creating payments...');
  let paymentCount = 0;
  const paidInvoices = invoices.filter(inv => Number(inv.amount_paid) > 0);

  for (let i = 0; i < paidInvoices.length; i++) {
    const inv = paidInvoices[i];
    const payDate = new Date(inv.invoice_date.getTime() + randomInt(1, 30) * 86400000);
    const year = payDate.getFullYear();
    const payNum = `PAY-${year}-${pad(i + 10, 3)}`;

    try {
      await prisma.payment.create({
        data: {
          payment_number: payNum,
          invoice_id: inv.id,
          customer_id: inv.customer_id,
          payment_date: payDate,
          amount: inv.amount_paid,
          payment_method: pick(PAYMENT_METHODS) as any,
          reference_number: Math.random() > 0.3 ? `REF-${randomInt(100000, 999999)}` : null,
          notes: Math.random() > 0.5 ? `Payment against ${inv.invoice_number}` : null,
          created_by: pick(allUsers).id,
        },
      });
      paymentCount++;
    } catch {
      // Skip duplicates
    }
  }
  console.log(`  ✅ ${paymentCount} payments`);

  // ================================================================
  // SUMMARY
  // ================================================================
  const counts = {
    users: await prisma.user.count(),
    locations: await prisma.location.count(),
    farmers: await prisma.farmer.count(),
    products: await prisma.product.count(),
    batches: await prisma.batch.count(),
    rawMaterials: await prisma.rawMaterial.count(),
    rmBatches: await prisma.rawMaterialBatch.count(),
    bomItems: await prisma.billOfMaterialItem.count(),
    customers: await prisma.customer.count(),
    suppliers: await prisma.supplier.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    trials: await prisma.trial.count(),
    salesOrders: await prisma.salesOrder.count(),
    invoices: await prisma.invoice.count(),
    payments: await prisma.payment.count(),
  };

  console.log('\n🎉 Mock data seed completed!');
  console.log('📊 Record counts:');
  for (const [key, val] of Object.entries(counts)) {
    console.log(`   ${key}: ${val}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Mock data seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
