import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function getProductsWithBOM(req: AuthRequest, res: Response) {
  try {
    const { page = '1', limit = '10', search } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Find products that have BOM items
    const productIdsWithBOM = await prisma.billOfMaterialItem.findMany({
      select: { product_id: true },
      distinct: ['product_id'],
    });

    const productIds = productIdsWithBOM.map((item) => item.product_id);

    const productWhere: any = {
      id: { in: productIds },
    };

    if (search) {
      productWhere.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { category: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: productWhere,
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          bom_items: {
            select: {
              id: true,
              quantity_per_unit: true,
              unit: true,
              updated_at: true,
              raw_material: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  category: true,
                },
              },
            },
            orderBy: { raw_material: { category: 'asc' } },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where: productWhere }),
    ]);

    const result = products.map((product) => ({
      product_id: product.id,
      product_name: product.name,
      product_category: product.category,
      product_description: product.description,
      material_count: product.bom_items.length,
      categories: [...new Set(product.bom_items.map((item) => item.raw_material.category))],
      last_updated: product.bom_items.reduce(
        (latest, item) => (item.updated_at > latest ? item.updated_at : latest),
        product.bom_items[0]?.updated_at || new Date()
      ),
    }));

    res.json({
      products: result,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get products with BOM error:', error);
    res.status(500).json({ error: 'Failed to get products with BOM' });
  }
}

export async function deleteProductBOM(req: AuthRequest, res: Response) {
  try {
    const { product_id } = req.params;

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: product_id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const deleted = await prisma.billOfMaterialItem.deleteMany({
      where: { product_id },
    });

    logger.info(`Deleted ${deleted.count} BOM items for product ${product_id}`);

    res.json({
      message: `Deleted ${deleted.count} BOM items for product ${product.name}`,
      count: deleted.count,
    });
  } catch (error) {
    logger.error('Delete product BOM error:', error);
    res.status(500).json({ error: 'Failed to delete product BOM' });
  }
}

export async function getAllBOMItems(req: AuthRequest, res: Response) {
  try {
    const { page = '1', limit = '10', product_id } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (product_id) {
      where.product_id = product_id;
    }

    const [bomItems, total] = await Promise.all([
      prisma.billOfMaterialItem.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
          raw_material: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
              unit: true,
            },
          },
        },
        orderBy: [
          { product: { name: 'asc' } },
          { created_at: 'desc' },
        ],
        skip,
        take: limitNum,
      }),
      prisma.billOfMaterialItem.count({ where }),
    ]);

    res.json({
      bom_items: bomItems,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get all BOM items error:', error);
    res.status(500).json({ error: 'Failed to get BOM items' });
  }
}

export async function createBOMItem(req: AuthRequest, res: Response) {
  try {
    const { product_id, raw_material_id, quantity_per_unit, unit, notes } = req.body;

    // Validate required fields
    if (!product_id || !raw_material_id || !quantity_per_unit || !unit) {
      return res.status(400).json({
        error: 'Product ID, raw material ID, quantity per unit, and unit are required',
      });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: product_id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if raw material exists
    const rawMaterial = await prisma.rawMaterial.findUnique({ where: { id: raw_material_id } });
    if (!rawMaterial) {
      return res.status(404).json({ error: 'Raw material not found' });
    }

    // Check if BOM item already exists
    const existing = await prisma.billOfMaterialItem.findUnique({
      where: {
        product_id_raw_material_id: {
          product_id,
          raw_material_id,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        error: 'This raw material is already in the BOM for this product',
      });
    }

    const bomItem = await prisma.billOfMaterialItem.create({
      data: {
        product_id,
        raw_material_id,
        quantity_per_unit,
        unit,
        notes,
        created_by: req.user!.userId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        raw_material: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            unit: true,
          },
        },
      },
    });

    res.status(201).json({ bom_item: bomItem });
  } catch (error) {
    logger.error('Create BOM item error:', error);
    res.status(500).json({ error: 'Failed to create BOM item' });
  }
}

export async function bulkCreateBOMItems(req: AuthRequest, res: Response) {
  try {
    const { product_id, items } = req.body;

    // Validate required fields
    if (!product_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Product ID and at least one item are required',
      });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: product_id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.raw_material_id || !item.quantity_per_unit || !item.unit) {
        return res.status(400).json({
          error: 'Each item must have raw_material_id, quantity_per_unit, and unit',
        });
      }
    }

    // Get unique raw material IDs
    const rawMaterialIds = [...new Set(items.map((item: any) => item.raw_material_id))];

    // Check for duplicates within the request
    if (rawMaterialIds.length !== items.length) {
      return res.status(400).json({
        error: 'Duplicate raw materials found in the request',
      });
    }

    // Check all raw materials exist
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: { id: { in: rawMaterialIds as string[] } },
    });

    if (rawMaterials.length !== rawMaterialIds.length) {
      return res.status(404).json({ error: 'One or more raw materials not found' });
    }

    // Check for existing BOM items for this product + these raw materials
    const existingItems = await prisma.billOfMaterialItem.findMany({
      where: {
        product_id,
        raw_material_id: { in: rawMaterialIds as string[] },
      },
      include: {
        raw_material: { select: { code: true, name: true } },
      },
    });

    if (existingItems.length > 0) {
      const existingNames = existingItems
        .map((item) => `${item.raw_material.code} - ${item.raw_material.name}`)
        .join(', ');
      return res.status(400).json({
        error: `These raw materials already exist in the BOM: ${existingNames}`,
      });
    }

    // Bulk create using transaction
    const createdItems = await prisma.$transaction(
      items.map((item: any) =>
        prisma.billOfMaterialItem.create({
          data: {
            product_id,
            raw_material_id: item.raw_material_id,
            quantity_per_unit: item.quantity_per_unit,
            unit: item.unit,
            notes: item.notes || null,
            created_by: req.user!.userId,
          },
          include: {
            product: {
              select: { id: true, name: true },
            },
            raw_material: {
              select: { id: true, code: true, name: true, category: true, unit: true },
            },
          },
        })
      )
    );

    logger.info(`Bulk created ${createdItems.length} BOM items for product ${product_id}`);

    res.status(201).json({
      bom_items: createdItems,
      count: createdItems.length,
    });
  } catch (error) {
    logger.error('Bulk create BOM items error:', error);
    res.status(500).json({ error: 'Failed to create BOM items' });
  }
}

export async function getBOMByProduct(req: AuthRequest, res: Response) {
  try {
    const { product_id } = req.params;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: product_id },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const bomItems = await prisma.billOfMaterialItem.findMany({
      where: { product_id },
      include: {
        raw_material: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            category: true,
            subcategory: true,
            specifications: true,
            unit: true,
            supplier_name: true,
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
      orderBy: [{ raw_material: { category: 'asc' } }, { created_at: 'asc' }],
    });

    res.json({
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
      },
      bom_items: bomItems,
      total_items: bomItems.length,
    });
  } catch (error) {
    logger.error('Get BOM by product error:', error);
    res.status(500).json({ error: 'Failed to get BOM' });
  }
}

export async function getBOMItemById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const bomItem = await prisma.billOfMaterialItem.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        raw_material: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            unit: true,
          },
        },
      },
    });

    if (!bomItem) {
      return res.status(404).json({ error: 'BOM item not found' });
    }

    res.json({ bom_item: bomItem });
  } catch (error) {
    logger.error('Get BOM item by ID error:', error);
    res.status(500).json({ error: 'Failed to get BOM item' });
  }
}

export async function updateBOMItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { quantity_per_unit, unit, notes } = req.body;

    // Check if BOM item exists
    const existing = await prisma.billOfMaterialItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'BOM item not found' });
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (quantity_per_unit !== undefined) updateData.quantity_per_unit = quantity_per_unit;
    if (unit !== undefined) updateData.unit = unit;
    if (notes !== undefined) updateData.notes = notes;

    const bomItem = await prisma.billOfMaterialItem.update({
      where: { id },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        raw_material: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
          },
        },
      },
    });

    res.json({ bom_item: bomItem });
  } catch (error) {
    logger.error('Update BOM item error:', error);
    res.status(500).json({ error: 'Failed to update BOM item' });
  }
}

export async function deleteBOMItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if BOM item exists
    const bomItem = await prisma.billOfMaterialItem.findUnique({ where: { id } });
    if (!bomItem) {
      return res.status(404).json({ error: 'BOM item not found' });
    }

    await prisma.billOfMaterialItem.delete({ where: { id } });

    res.json({ message: 'BOM item deleted successfully' });
  } catch (error) {
    logger.error('Delete BOM item error:', error);
    res.status(500).json({ error: 'Failed to delete BOM item' });
  }
}

export async function calculateMaterialRequirements(req: AuthRequest, res: Response) {
  try {
    const { product_id } = req.params;
    const { quantity_to_produce, unit } = req.query;

    if (!quantity_to_produce) {
      return res.status(400).json({ error: 'Quantity to produce is required' });
    }

    // Get BOM for product
    const bomItems = await prisma.billOfMaterialItem.findMany({
      where: { product_id },
      include: {
        raw_material: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            unit: true,
          },
        },
      },
    });

    if (bomItems.length === 0) {
      return res.status(400).json({
        error: 'No BOM defined for this product. Please add raw materials first.',
      });
    }

    // Calculate requirements
    const quantityNum = Number(quantity_to_produce);
    const requirements = bomItems.map((item) => ({
      raw_material_id: item.raw_material_id,
      raw_material_code: item.raw_material.code,
      raw_material_name: item.raw_material.name,
      category: item.raw_material.category,
      quantity_needed: item.quantity_per_unit * quantityNum,
      unit: item.unit,
    }));

    res.json({
      product_id,
      quantity_to_produce: quantityNum,
      unit,
      requirements,
      total_materials: requirements.length,
    });
  } catch (error) {
    logger.error('Calculate material requirements error:', error);
    res.status(500).json({ error: 'Failed to calculate material requirements' });
  }
}

export async function checkMaterialAvailability(req: AuthRequest, res: Response) {
  try {
    const { product_id } = req.params;
    const { quantity_to_produce } = req.query;

    if (!quantity_to_produce) {
      return res.status(400).json({ error: 'Quantity to produce is required' });
    }

    // Get BOM for product
    const bomItems = await prisma.billOfMaterialItem.findMany({
      where: { product_id },
      include: {
        raw_material: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            unit: true,
          },
        },
      },
    });

    if (bomItems.length === 0) {
      return res.status(400).json({
        error: 'No BOM defined for this product',
      });
    }

    const quantityNum = Number(quantity_to_produce);
    const availabilityChecks = [];

    for (const item of bomItems) {
      const quantityNeeded = item.quantity_per_unit * quantityNum;

      // Get available stock for this raw material
      const batches = await prisma.rawMaterialBatch.findMany({
        where: {
          raw_material_id: item.raw_material_id,
          is_active: true,
          quantity_remaining: { gt: 0 },
        },
      });

      const totalAvailable = batches.reduce((sum, batch) => sum + batch.quantity_remaining, 0);
      const isAvailable = totalAvailable >= quantityNeeded;

      availabilityChecks.push({
        raw_material_id: item.raw_material_id,
        raw_material_code: item.raw_material.code,
        raw_material_name: item.raw_material.name,
        category: item.raw_material.category,
        quantity_needed: quantityNeeded,
        quantity_available: totalAvailable,
        unit: item.unit,
        is_available: isAvailable,
        shortage: isAvailable ? 0 : quantityNeeded - totalAvailable,
      });
    }

    const allAvailable = availabilityChecks.every((check) => check.is_available);

    res.json({
      product_id,
      quantity_to_produce: quantityNum,
      can_produce: allAvailable,
      availability_checks: availabilityChecks,
      shortages: availabilityChecks.filter((check) => !check.is_available),
    });
  } catch (error) {
    logger.error('Check material availability error:', error);
    res.status(500).json({ error: 'Failed to check material availability' });
  }
}
