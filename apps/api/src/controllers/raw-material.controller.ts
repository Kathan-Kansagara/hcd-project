import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createRawMaterial(req: AuthRequest, res: Response) {
  try {
    let {
      code,
      name,
      description,
      category,
      subcategory,
      specifications,
      unit,
      gst_rate,
      hsn_sac_code,
      default_unit_price,
      min_stock_level,
      reorder_point,
      supplier_name,
    } = req.body;

    // Validate required fields
    if (!name || !category || !unit) {
      return res.status(400).json({ error: 'Name, category, and unit are required' });
    }

    // Auto-generate code if not provided, or if provided code already exists
    const generateUniqueCode = async () => {
      const count = await prisma.rawMaterial.count();
      const paddedNumber = String(count + 1).padStart(4, '0');
      let generatedCode = `RM-${paddedNumber}`;

      // Ensure uniqueness
      let suffix = 1;
      while (await prisma.rawMaterial.findUnique({ where: { code: generatedCode } })) {
        generatedCode = `RM-${paddedNumber}-${suffix}`;
        suffix++;
      }
      return generatedCode;
    };

    if (!code) {
      code = await generateUniqueCode();
    } else {
      // Reject if provided code already exists
      const existing = await prisma.rawMaterial.findUnique({
        where: { code },
      });
      if (existing) {
        return res.status(400).json({ error: `Raw material with code '${code}' already exists` });
      }
    }

    const rawMaterial = await prisma.rawMaterial.create({
      data: {
        code,
        name,
        description,
        category,
        subcategory,
        specifications,
        unit,
        gst_rate: gst_rate !== undefined ? Number(gst_rate) : undefined,
        hsn_sac_code,
        default_unit_price: default_unit_price !== undefined ? Number(default_unit_price) : undefined,
        min_stock_level,
        reorder_point,
        supplier_name,
        created_by: req.user!.userId,
      },
    });

    res.status(201).json({ raw_material: rawMaterial });
  } catch (error) {
    logger.error('Create raw material error:', error);
    res.status(500).json({ error: 'Failed to create raw material' });
  }
}

export async function getRawMaterials(req: AuthRequest, res: Response) {
  try {
    const {
      search,
      category,
      subcategory,
      is_active = 'true',
      page = '1',
      limit = '20',
      sortBy,
      sortOrder,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    // Filter by active status
    if (is_active !== 'all') {
      where.is_active = is_active === 'true';
    }

    // Search by code, name, or description
    if (search) {
      where.OR = [
        { code: { contains: String(search), mode: 'insensitive' } },
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    // Filter by category
    if (category) {
      where.category = { contains: String(category), mode: 'insensitive' };
    }

    // Filter by subcategory
    if (subcategory) {
      where.subcategory = { contains: String(subcategory), mode: 'insensitive' };
    }

    // Server-side sorting
    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      name: { name: sortDir },
      code: { code: sortDir },
      category: { category: sortDir },
      current_stock_quantity: { current_stock_quantity: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { created_at: 'desc' };

    const [raw_materials, total] = await Promise.all([
      prisma.rawMaterial.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          category: true,
          subcategory: true,
          specifications: true,
          unit: true,
          gst_rate: true,
          hsn_sac_code: true,
          default_unit_price: true,
          min_stock_level: true,
          reorder_point: true,
          supplier_name: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
        },
      }),
      prisma.rawMaterial.count({ where }),
    ]);

    res.json({
      raw_materials,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get raw materials error:', error);
    res.status(500).json({ error: 'Failed to get raw materials' });
  }
}

export async function getRawMaterialById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { id },
      include: {
        stock_batches: {
          where: { is_active: true },
          orderBy: { expiry_date: 'asc' },
          select: {
            id: true,
            batch_number: true,
            quantity_remaining: true,
            unit: true,
            expiry_date: true,
            storage_location: true,
            quality_status: true,
          },
        },
        bom_items: {
          select: {
            id: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            quantity_per_unit: true,
            unit: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!rawMaterial) {
      return res.status(404).json({ error: 'Raw material not found' });
    }

    res.json({ raw_material: rawMaterial });
  } catch (error) {
    logger.error('Get raw material by ID error:', error);
    res.status(500).json({ error: 'Failed to get raw material' });
  }
}

export async function updateRawMaterial(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      description,
      category,
      subcategory,
      specifications,
      unit,
      gst_rate,
      hsn_sac_code,
      default_unit_price,
      min_stock_level,
      reorder_point,
      supplier_name,
      is_active,
    } = req.body;

    // Check if raw material exists
    const existing = await prisma.rawMaterial.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Raw material not found' });
    }

    // Check if code is being changed and if new code already exists
    if (code && code !== existing.code) {
      const codeExists = await prisma.rawMaterial.findUnique({ where: { code } });
      if (codeExists) {
        return res.status(400).json({ error: 'Raw material with this code already exists' });
      }
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory;
    if (specifications !== undefined) updateData.specifications = specifications;
    if (unit !== undefined) updateData.unit = unit;
    if (min_stock_level !== undefined) updateData.min_stock_level = min_stock_level;
    if (reorder_point !== undefined) updateData.reorder_point = reorder_point;
    if (gst_rate !== undefined) updateData.gst_rate = Number(gst_rate);
    if (hsn_sac_code !== undefined) updateData.hsn_sac_code = hsn_sac_code;
    if (default_unit_price !== undefined) updateData.default_unit_price = Number(default_unit_price);
    if (supplier_name !== undefined) updateData.supplier_name = supplier_name;
    if (is_active !== undefined) updateData.is_active = is_active;

    const rawMaterial = await prisma.rawMaterial.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        category: true,
        subcategory: true,
        specifications: true,
        unit: true,
        gst_rate: true,
        hsn_sac_code: true,
        default_unit_price: true,
        min_stock_level: true,
        reorder_point: true,
        supplier_name: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    res.json({ raw_material: rawMaterial });
  } catch (error) {
    logger.error('Update raw material error:', error);
    res.status(500).json({ error: 'Failed to update raw material' });
  }
}

export async function deleteRawMaterial(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if raw material exists
    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { id },
      include: {
        stock_batches: true,
        bom_items: true,
      },
    });

    if (!rawMaterial) {
      return res.status(404).json({ error: 'Raw material not found' });
    }

    // Check if raw material has stock batches
    if (rawMaterial.stock_batches.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete raw material with existing stock batches. Please remove all batches first.',
      });
    }

    // Check if raw material is used in any BOM
    if (rawMaterial.bom_items.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete raw material used in bill of materials. Please remove from all products first.',
      });
    }

    await prisma.rawMaterial.delete({
      where: { id },
    });

    res.json({ message: 'Raw material deleted successfully' });
  } catch (error) {
    logger.error('Delete raw material error:', error);
    res.status(500).json({ error: 'Failed to delete raw material' });
  }
}

export async function getRawMaterialCategories(req: AuthRequest, res: Response) {
  try {
    const materials = await prisma.rawMaterial.findMany({
      select: {
        category: true,
      },
      distinct: ['category'],
      orderBy: {
        category: 'asc',
      },
    });

    const categories = materials.map((m) => m.category).filter((c): c is string => c !== null);

    res.json({ categories });
  } catch (error) {
    logger.error('Get raw material categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
}

export async function getStockSummary(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { id },
    });

    if (!rawMaterial) {
      return res.status(404).json({ error: 'Raw material not found' });
    }

    // Get total stock
    const batches = await prisma.rawMaterialBatch.findMany({
      where: {
        raw_material_id: id,
        is_active: true,
        quality_status: 'APPROVED',
      },
    });

    const totalStock = batches.reduce((sum, batch) => sum + batch.quantity_remaining, 0);

    // Check for low stock
    const isLowStock = rawMaterial.min_stock_level
      ? totalStock < rawMaterial.min_stock_level
      : false;

    const needsReorder = rawMaterial.reorder_point
      ? totalStock <= rawMaterial.reorder_point
      : false;

    // Get expiring batches (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringBatches = batches.filter(
      (batch) => batch.expiry_date && batch.expiry_date <= thirtyDaysFromNow
    );

    res.json({
      raw_material_id: id,
      total_stock: totalStock,
      unit: rawMaterial.unit,
      min_stock_level: rawMaterial.min_stock_level,
      reorder_point: rawMaterial.reorder_point,
      is_low_stock: isLowStock,
      needs_reorder: needsReorder,
      total_batches: batches.length,
      expiring_batches_count: expiringBatches.length,
      expiring_batches: expiringBatches.map((b) => ({
        id: b.id,
        batch_number: b.batch_number,
        quantity_remaining: b.quantity_remaining,
        expiry_date: b.expiry_date,
      })),
    });
  } catch (error) {
    logger.error('Get stock summary error:', error);
    res.status(500).json({ error: 'Failed to get stock summary' });
  }
}

export async function getNextCode(req: AuthRequest, res: Response) {
  try {
    const count = await prisma.rawMaterial.count();
    const paddedNumber = String(count + 1).padStart(4, '0');
    let code = `RM-${paddedNumber}`;

    // Ensure uniqueness
    let suffix = 1;
    while (await prisma.rawMaterial.findUnique({ where: { code } })) {
      code = `RM-${paddedNumber}-${suffix}`;
      suffix++;
    }

    res.json({ code });
  } catch (error) {
    logger.error('Get next code error:', error);
    res.status(500).json({ error: 'Failed to get next code' });
  }
}

export async function getSuppliers(req: AuthRequest, res: Response) {
  try {
    const materials = await prisma.rawMaterial.findMany({
      where: {
        supplier_name: {
          not: null,
        },
      },
      select: {
        supplier_name: true,
      },
      distinct: ['supplier_name'],
      orderBy: {
        supplier_name: 'asc',
      },
    });

    const suppliers = materials
      .map((m) => m.supplier_name)
      .filter((s): s is string => s !== null && s !== '');

    res.json({ suppliers });
  } catch (error) {
    logger.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Failed to get suppliers' });
  }
}
