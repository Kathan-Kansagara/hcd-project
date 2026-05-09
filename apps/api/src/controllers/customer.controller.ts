import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GSTIN validation regex (15 characters: 2 digits + 10 alphanumeric + 1 alphabet + 1 digit + 1 alphabet/digit + 1 alphabet/digit)
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export async function createCustomer(req: AuthRequest, res: Response) {
  try {
    const {
      customer_type = 'company',
      company_name,
      client_name,
      contact,
      email,
      address_line1,
      address_line2,
      city,
      state,
      district,
      pincode,
      gstin,
      place_of_supply,
      payment_terms,
    } = req.body;

    const isIndividual = customer_type === 'individual';

    // Validate required fields based on customer type
    if (!company_name || !contact) {
      return res.status(400).json({
        error: 'Name and contact are required'
      });
    }

    // For company customers, require more fields
    if (!isIndividual) {
      if (!email || !address_line1 || !city || !state || !pincode || !place_of_supply || !payment_terms) {
        return res.status(400).json({
          error: 'company_name, contact, email, address_line1, city, state, pincode, place_of_supply, and payment_terms are required for company customers'
        });
      }
    }

    // Validate email format if provided
    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate GSTIN format if provided
    if (gstin && !GSTIN_REGEX.test(gstin)) {
      return res.status(400).json({ error: 'Invalid GSTIN format. Must be 15 characters (e.g., 27AABCT1332L1ZV)' });
    }

    // Create or find location if location fields are provided
    let location_id = null;
    if (city || state || district || pincode) {
      const location = await prisma.location.create({
        data: {
          city: city || null,
          state: state || null,
          district: district || null,
          pincode: pincode || null,
        },
      });
      location_id = location.id;
    }

    const customer = await prisma.customer.create({
      data: {
        customer_type: isIndividual ? 'individual' : 'company',
        company_name,
        client_name: client_name || null,
        contact,
        email: email || null,
        address_line1: address_line1 || null,
        address_line2: address_line2 || null,
        location_id,
        gstin: gstin || null,
        place_of_supply: place_of_supply || null,
        payment_terms: payment_terms || (isIndividual ? 'Immediate' : 'Net 30'),
        created_by: req.user!.userId,
      },
      include: {
        location: true,
      },
    });

    logger.info(`Customer created: ${customer.id} (type: ${customer_type})`);
    res.status(201).json({ customer });
  } catch (error) {
    logger.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
}

export async function getCustomers(req: AuthRequest, res: Response) {
  try {
    const { search, is_active, customer_type, page = '1', limit = '20', sortBy, sortOrder } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    // Filter by active status (default to active only)
    if (is_active === 'false') {
      where.is_active = false;
    } else if (is_active !== 'all') {
      where.is_active = true;
    }

    // Filter by customer type
    if (customer_type && customer_type !== 'all') {
      where.customer_type = String(customer_type);
    }

    // Search by company name, email, or contact
    if (search) {
      where.OR = [
        { company_name: { contains: String(search), mode: 'insensitive' } },
        { client_name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
        { contact: { contains: String(search) } },
      ];
    }

    // Server-side sorting
    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      company_name: { company_name: sortDir },
      email: { email: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { created_at: 'desc' };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          customer_type: true,
          company_name: true,
          client_name: true,
          contact: true,
          email: true,
          address_line1: true,
          address_line2: true,
          location: {
            select: {
              city: true,
              district: true,
              state: true,
              pincode: true,
            },
          },
          gstin: true,
          place_of_supply: true,
          payment_terms: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    // Flatten location data for backwards compatibility
    const customersWithFlatLocation = customers.map(customer => ({
      ...customer,
      city: customer.location?.city || null,
      state: customer.location?.state || null,
      district: customer.location?.district || null,
      pincode: customer.location?.pincode || null,
    }));

    res.json({
      customers: customersWithFlatLocation,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to get customers' });
  }
}

export async function getCustomerById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        location: true,
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
        sales_orders: {
          select: {
            id: true,
            so_number: true,
            order_date: true,
            status: true,
          },
          orderBy: { order_date: 'desc' },
          take: 10,
        },
        invoices: {
          select: {
            id: true,
            invoice_number: true,
            invoice_date: true,
            grand_total: true,
            amount_due: true,
            status: true,
          },
          orderBy: { invoice_date: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Flatten location data for backwards compatibility
    const customerWithFlatLocation = {
      ...customer,
      city: customer.location?.city || null,
      state: customer.location?.state || null,
      district: customer.location?.district || null,
      pincode: customer.location?.pincode || null,
    };

    res.json(customerWithFlatLocation);
  } catch (error) {
    logger.error('Get customer by ID error:', error);
    res.status(500).json({ error: 'Failed to get customer' });
  }
}

export async function updateCustomer(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      company_name,
      client_name,
      contact,
      email,
      address_line1,
      address_line2,
      city,
      state,
      district,
      pincode,
      gstin,
      place_of_supply,
      payment_terms,
    } = req.body;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
      include: { location: true }
    });
    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const { customer_type } = req.body;
    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (customer_type !== undefined) updateData.customer_type = customer_type;
    if (company_name !== undefined) updateData.company_name = company_name;
    if (client_name !== undefined) updateData.client_name = client_name;
    if (contact !== undefined) updateData.contact = contact;
    if (email !== undefined) {
      // Validate email format if provided and not empty
      if (email && !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      updateData.email = email || null;
    }
    if (address_line1 !== undefined) updateData.address_line1 = address_line1;
    if (address_line2 !== undefined) updateData.address_line2 = address_line2;

    // Handle location updates
    if (city !== undefined || state !== undefined || district !== undefined || pincode !== undefined) {
      if (existingCustomer.location_id) {
        // Update existing location
        await prisma.location.update({
          where: { id: existingCustomer.location_id },
          data: {
            ...(city !== undefined && { city }),
            ...(state !== undefined && { state }),
            ...(district !== undefined && { district }),
            ...(pincode !== undefined && { pincode }),
          },
        });
      } else {
        // Create new location
        const location = await prisma.location.create({
          data: {
            city: city || null,
            state: state || null,
            district: district || null,
            pincode: pincode || null,
          },
        });
        updateData.location_id = location.id;
      }
    }

    if (gstin !== undefined) {
      // Validate GSTIN format if provided
      if (gstin && !GSTIN_REGEX.test(gstin)) {
        return res.status(400).json({ error: 'Invalid GSTIN format. Must be 15 characters (e.g., 27AABCT1332L1ZV)' });
      }
      updateData.gstin = gstin;
    }
    if (place_of_supply !== undefined) updateData.place_of_supply = place_of_supply;
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms;

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
      include: {
        location: true,
      },
    });

    // Flatten location data for backwards compatibility
    const customerWithFlatLocation = {
      ...customer,
      city: customer.location?.city || null,
      state: customer.location?.state || null,
      district: customer.location?.district || null,
      pincode: customer.location?.pincode || null,
    };

    res.json({ customer: customerWithFlatLocation });
  } catch (error) {
    logger.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
}

export async function deleteCustomer(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if customer exists
    const customer = await prisma.customer.findUnique({ where: { id } });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Soft delete by setting is_active to false
    const deletedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        is_active: false,
      },
    });

    res.json({ message: 'Customer deleted successfully', customer: deletedCustomer });
  } catch (error) {
    logger.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
}
