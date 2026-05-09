import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GSTIN validation regex (15 characters: 2 digits + 10 alphanumeric + 1 alphabet + 1 digit + 1 alphabet/digit + 1 alphabet/digit)
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export async function createSupplier(req: AuthRequest, res: Response) {
  try {
    const {
      company_name,
      contact_person,
      contact,
      email,
      address_line1,
      address_line2,
      city,
      state,
      district,
      pincode,
      gstin,
      payment_terms,
    } = req.body;

    // Validate required fields
    if (!company_name) {
      return res.status(400).json({
        error: 'company_name is required'
      });
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

    const supplier = await prisma.supplier.create({
      data: {
        company_name,
        contact_person,
        contact,
        email,
        address_line1,
        address_line2,
        location_id,
        gstin,
        payment_terms,
        created_by: req.user!.userId,
      },
      include: {
        location: true,
      },
    });

    res.status(201).json({ supplier });
  } catch (error) {
    logger.error('Create supplier error:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
}

export async function getSuppliers(req: AuthRequest, res: Response) {
  try {
    const { search, is_active, page = '1', limit = '20', sortBy, sortOrder } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    // Filter by active status (default to active only)
    if (is_active === 'false') {
      where.is_active = false;
    } else if (is_active !== 'all') {
      where.is_active = true;
    }

    // Search by company name, email, or contact
    if (search) {
      where.OR = [
        { company_name: { contains: String(search), mode: 'insensitive' } },
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

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          company_name: true,
          contact_person: true,
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
          payment_terms: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    // Flatten location data for backwards compatibility
    const suppliersWithFlatLocation = suppliers.map(supplier => ({
      ...supplier,
      city: supplier.location?.city || null,
      state: supplier.location?.state || null,
      district: supplier.location?.district || null,
      pincode: supplier.location?.pincode || null,
    }));

    res.json({
      suppliers: suppliersWithFlatLocation,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Failed to get suppliers' });
  }
}

export async function getSupplierById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        location: true,
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
        purchase_orders: {
          select: {
            id: true,
            po_number: true,
            order_date: true,
            status: true,
          },
          orderBy: { order_date: 'desc' },
          take: 10,
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Flatten location data for backwards compatibility
    const supplierWithFlatLocation = {
      ...supplier,
      city: supplier.location?.city || null,
      state: supplier.location?.state || null,
      district: supplier.location?.district || null,
      pincode: supplier.location?.pincode || null,
    };

    res.json(supplierWithFlatLocation);
  } catch (error) {
    logger.error('Get supplier by ID error:', error);
    res.status(500).json({ error: 'Failed to get supplier' });
  }
}

export async function updateSupplier(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      company_name,
      contact_person,
      contact,
      email,
      address_line1,
      address_line2,
      city,
      state,
      district,
      pincode,
      gstin,
      payment_terms,
    } = req.body;

    // Check if supplier exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
      include: { location: true }
    });
    if (!existingSupplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (company_name !== undefined) updateData.company_name = company_name;
    if (contact_person !== undefined) updateData.contact_person = contact_person;
    if (contact !== undefined) updateData.contact = contact;
    if (email !== undefined) {
      // Validate email format
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      updateData.email = email;
    }
    if (address_line1 !== undefined) updateData.address_line1 = address_line1;
    if (address_line2 !== undefined) updateData.address_line2 = address_line2;

    // Handle location updates
    if (city !== undefined || state !== undefined || district !== undefined || pincode !== undefined) {
      if (existingSupplier.location_id) {
        // Update existing location
        await prisma.location.update({
          where: { id: existingSupplier.location_id },
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
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: updateData,
      include: {
        location: true,
      },
    });

    // Flatten location data for backwards compatibility
    const supplierWithFlatLocation = {
      ...supplier,
      city: supplier.location?.city || null,
      state: supplier.location?.state || null,
      district: supplier.location?.district || null,
      pincode: supplier.location?.pincode || null,
    };

    res.json({ supplier: supplierWithFlatLocation });
  } catch (error) {
    logger.error('Update supplier error:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
}

export async function deleteSupplier(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id } });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Soft delete by setting is_active to false
    const deletedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        is_active: false,
      },
    });

    res.json({ message: 'Supplier deleted successfully', supplier: deletedSupplier });
  } catch (error) {
    logger.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
}
