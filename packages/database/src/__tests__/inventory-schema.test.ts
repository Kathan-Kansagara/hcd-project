import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Inventory Management Schema Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Get or create a test user
    const testUser = await prisma.user.findFirst({
      where: { email: 'admin@zenon.com' }
    });

    if (testUser) {
      testUserId = testUser.id;
    } else {
      throw new Error('Test user not found. Please run seed first.');
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.payment.deleteMany({
      where: { customer: { email: { contains: 'test-schema' } } }
    });
    await prisma.invoice.deleteMany({
      where: { customer: { email: { contains: 'test-schema' } } }
    });
    await prisma.salesOrder.deleteMany({
      where: { customer_rel: { email: { contains: 'test-schema' } } }
    });
    await prisma.customer.deleteMany({
      where: { email: { contains: 'test-schema' } }
    });

    await prisma.$disconnect();
  });

  // Test 1: Customer entity creation
  test('should create a customer with all required fields', async () => {
    const customer = await prisma.customer.create({
      data: {
        company_name: 'Test Company Ltd',
        client_name: 'John Doe',
        contact: '9876543210',
        email: 'test-schema-customer@example.com',
        address_line1: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456',
        place_of_supply: '24-Gujarat',
        payment_terms: 'Net 30',
        created_by: testUserId,
      },
    });

    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.company_name).toBe('Test Company Ltd');
    expect(customer.is_active).toBe(true);
    expect(customer.created_at).toBeInstanceOf(Date);
  });

  // Test 2: Invoice entity creation with relationship
  test('should create an invoice linked to customer and sales order', async () => {
    // Create customer
    const customer = await prisma.customer.create({
      data: {
        company_name: 'Invoice Test Co',
        contact: '9876543211',
        email: 'test-schema-invoice@example.com',
        address_line1: '456 Invoice Street',
        city: 'Invoice City',
        state: 'Invoice State',
        pincode: '654321',
        place_of_supply: '24-Gujarat',
        payment_terms: 'Net 15',
        created_by: testUserId,
      },
    });

    // Create sales order
    const salesOrder = await prisma.salesOrder.create({
      data: {
        so_number: 'SO-TEST-001',
        customer_id: customer.id,
        order_date: new Date(),
        status: 'PENDING',
        created_by: testUserId,
      },
    });

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: 'INV-TEST-001',
        sales_order_id: salesOrder.id,
        customer_id: customer.id,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        place_of_supply: '24-Gujarat',
        sub_total: 10000,
        taxable_amount: 10000,
        cgst_amount: 900,
        sgst_amount: 900,
        total_gst: 1800,
        grand_total: 11800,
        amount_due: 11800,
        status: 'DRAFT',
        created_by: testUserId,
      },
    });

    expect(invoice).toBeDefined();
    expect(invoice.invoice_number).toBe('INV-TEST-001');
    expect(invoice.customer_id).toBe(customer.id);
    expect(invoice.sales_order_id).toBe(salesOrder.id);
    expect(invoice.status).toBe('DRAFT');
  });

  // Test 3: Enum validation for PaymentMethod
  test('should accept valid payment method enum values', async () => {
    const customer = await prisma.customer.create({
      data: {
        company_name: 'Payment Test Co',
        contact: '9876543212',
        email: 'test-schema-payment@example.com',
        address_line1: '789 Payment St',
        city: 'Payment City',
        state: 'Payment State',
        pincode: '789012',
        place_of_supply: '24-Gujarat',
        payment_terms: 'Net 30',
        created_by: testUserId,
      },
    });

    const salesOrder = await prisma.salesOrder.create({
      data: {
        so_number: 'SO-TEST-002',
        customer_id: customer.id,
        order_date: new Date(),
        status: 'PENDING',
        created_by: testUserId,
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: 'INV-TEST-002',
        sales_order_id: salesOrder.id,
        customer_id: customer.id,
        invoice_date: new Date(),
        due_date: new Date(),
        place_of_supply: '24-Gujarat',
        sub_total: 5000,
        taxable_amount: 5000,
        cgst_amount: 450,
        sgst_amount: 450,
        total_gst: 900,
        grand_total: 5900,
        amount_paid: 5900,
        amount_due: 0,
        status: 'PAID',
        created_by: testUserId,
      },
    });

    const payment = await prisma.payment.create({
      data: {
        payment_number: 'PAY-TEST-001',
        invoice_id: invoice.id,
        customer_id: customer.id,
        payment_date: new Date(),
        amount: 5900,
        payment_method: 'UPI',
        created_by: testUserId,
      },
    });

    expect(payment).toBeDefined();
    expect(payment.payment_method).toBe('UPI');
  });

  // Test 4: Enum validation for InvoiceStatus
  test('should accept valid invoice status enum values', async () => {
    const customer = await prisma.customer.create({
      data: {
        company_name: 'Status Test Co',
        contact: '9876543213',
        email: 'test-schema-status@example.com',
        address_line1: '101 Status Ave',
        city: 'Status City',
        state: 'Status State',
        pincode: '101010',
        place_of_supply: '24-Gujarat',
        payment_terms: 'Net 30',
        created_by: testUserId,
      },
    });

    const salesOrder = await prisma.salesOrder.create({
      data: {
        so_number: 'SO-TEST-003',
        customer_id: customer.id,
        order_date: new Date(),
        status: 'PENDING',
        created_by: testUserId,
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: 'INV-TEST-003',
        sales_order_id: salesOrder.id,
        customer_id: customer.id,
        invoice_date: new Date(),
        due_date: new Date(),
        place_of_supply: '24-Gujarat',
        sub_total: 1000,
        taxable_amount: 1000,
        cgst_amount: 90,
        sgst_amount: 90,
        total_gst: 180,
        grand_total: 1180,
        amount_paid: 500,
        amount_due: 680,
        status: 'PARTIALLY_PAID',
        created_by: testUserId,
      },
    });

    expect(invoice.status).toBe('PARTIALLY_PAID');

    // Update status to OVERDUE
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'OVERDUE' },
    });

    expect(updatedInvoice.status).toBe('OVERDUE');
  });

  // Test 5: Customer-Invoice relationship
  test('should retrieve customer with related invoices', async () => {
    const customer = await prisma.customer.create({
      data: {
        company_name: 'Relation Test Co',
        contact: '9876543214',
        email: 'test-schema-relation@example.com',
        address_line1: '202 Relation Rd',
        city: 'Relation City',
        state: 'Relation State',
        pincode: '202020',
        place_of_supply: '24-Gujarat',
        payment_terms: 'Net 30',
        created_by: testUserId,
      },
    });

    const salesOrder = await prisma.salesOrder.create({
      data: {
        so_number: 'SO-TEST-004',
        customer_id: customer.id,
        order_date: new Date(),
        status: 'PENDING',
        created_by: testUserId,
      },
    });

    await prisma.invoice.create({
      data: {
        invoice_number: 'INV-TEST-004',
        sales_order_id: salesOrder.id,
        customer_id: customer.id,
        invoice_date: new Date(),
        due_date: new Date(),
        place_of_supply: '24-Gujarat',
        sub_total: 2000,
        taxable_amount: 2000,
        cgst_amount: 180,
        sgst_amount: 180,
        total_gst: 360,
        grand_total: 2360,
        amount_due: 2360,
        status: 'SENT',
        created_by: testUserId,
      },
    });

    const customerWithInvoices = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: { invoices: true },
    });

    expect(customerWithInvoices).toBeDefined();
    expect(customerWithInvoices?.invoices).toHaveLength(1);
    expect(customerWithInvoices?.invoices[0].invoice_number).toBe('INV-TEST-004');
  });

  // Test 6: CompanySettings entity creation
  test('should create company settings with all required fields', async () => {
    // Clean up any existing settings first
    await prisma.companySettings.deleteMany();

    const companySettings = await prisma.companySettings.create({
      data: {
        company_name: 'Test Company Pvt Ltd',
        address_line1: 'Test Address Line 1',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456',
        gstin: '24AAQFB7049G1ZA',
        bank_name: 'Test Bank',
        bank_account_number: '1234567890',
        ifsc_code: 'TEST0001234',
        invoice_terms_and_conditions: 'Test Terms and Conditions',
        invoice_prefix: 'GT/',
      },
    });

    expect(companySettings).toBeDefined();
    expect(companySettings.company_name).toBe('Test Company Pvt Ltd');
    expect(companySettings.invoice_prefix).toBe('GT/');
    expect(companySettings.gstin).toBe('24AAQFB7049G1ZA');
  });

  // Test 7: RawMaterial extensions (GST fields)
  test('should verify RawMaterial has inventory management fields', async () => {
    const rawMaterial = await prisma.rawMaterial.create({
      data: {
        code: 'RM-TEST-001',
        name: 'Test Raw Material',
        category: 'TEST_CATEGORY',
        unit: 'KG',
        gst_rate: 18.0,
        hsn_sac_code: '1234',
        default_unit_price: 100.50,
        current_stock_quantity: 50.0,
        weighted_average_cost: 95.75,
        min_stock_level_inventory: 10.0,
        created_by: testUserId,
      },
    });

    expect(rawMaterial).toBeDefined();
    expect(rawMaterial.gst_rate).toBeDefined();
    expect(rawMaterial.hsn_sac_code).toBe('1234');
    expect(rawMaterial.default_unit_price).toBeDefined();
    expect(rawMaterial.current_stock_quantity).toBeDefined();
    expect(rawMaterial.weighted_average_cost).toBeDefined();

    // Cleanup
    await prisma.rawMaterial.delete({ where: { id: rawMaterial.id } });
  });

  // Test 8: Supplier and PurchaseOrder relationship
  test('should create supplier and link to purchase order', async () => {
    const supplier = await prisma.supplier.create({
      data: {
        company_name: 'Test Supplier Co',
        contact: '9876543215',
        email: 'test-supplier@example.com',
        address_line1: '303 Supplier St',
        city: 'Supplier City',
        state: 'Supplier State',
        pincode: '303030',
        payment_terms: 'Net 60',
        created_by: testUserId,
      },
    });

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        po_number: 'PO-TEST-001',
        supplier_id: supplier.id,
        order_date: new Date(),
        status: 'PENDING',
        created_by: testUserId,
      },
    });

    expect(purchaseOrder).toBeDefined();
    expect(purchaseOrder.supplier_id).toBe(supplier.id);
    expect(purchaseOrder.status).toBe('PENDING');

    // Cleanup
    await prisma.purchaseOrder.delete({ where: { id: purchaseOrder.id } });
    await prisma.supplier.delete({ where: { id: supplier.id } });
  });
});
