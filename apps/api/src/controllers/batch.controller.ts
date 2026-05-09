import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createBatch(req: AuthRequest, res: Response) {
  try {
    const {
      product_id,
      batch_number,
      manufacturing_date,
      expiry_date,
      quantity_produced,
      unit,
      storage_location,
      notes,
    } = req.body;

    // Validate required fields
    if (!product_id || !batch_number || !manufacturing_date || !expiry_date || !quantity_produced || !unit) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if batch number already exists
    const existingBatch = await prisma.batch.findUnique({ where: { batch_number } });
    if (existingBatch) {
      return res.status(400).json({ error: 'Batch number already exists' });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: product_id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const batch = await prisma.batch.create({
      data: {
        product_id,
        batch_number,
        manufacturing_date: new Date(manufacturing_date),
        expiry_date: new Date(expiry_date),
        quantity_produced: parseFloat(quantity_produced),
        quantity_remaining: parseFloat(quantity_produced), // Initially same as produced
        unit,
        storage_location,
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
      },
    });

    res.status(201).json({ batch });
  } catch (error) {
    logger.error('Create batch error:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
}

export async function getBatches(req: AuthRequest, res: Response) {
  try {
    const {
      search,
      product_id,
      is_active,
      page = '1',
      limit = '20',
      sortBy,
      sortOrder,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (search) {
      where.OR = [
        { batch_number: { contains: String(search), mode: 'insensitive' } },
        { notes: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    if (product_id) {
      where.product_id = String(product_id);
    }

    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    // Server-side sorting
    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      batch_number: { batch_number: sortDir },
      manufacturing_date: { manufacturing_date: sortDir },
      expiry_date: { expiry_date: sortDir },
      quantity_remaining: { quantity_remaining: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { created_at: 'desc' };

    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          applications: {
            select: {
              id: true,
            },
          },
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
        },
      }),
      prisma.batch.count({ where }),
    ]);

    // Add computed fields for expiry status
    const batchesWithStatus = batches.map((batch) => {
      const now = new Date();
      const expiryDate = new Date(batch.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let expiryStatus = 'active';
      if (daysUntilExpiry < 0) {
        expiryStatus = 'expired';
      } else if (daysUntilExpiry <= 30) {
        expiryStatus = 'expiring_soon';
      }

      return {
        ...batch,
        expiry_status: expiryStatus,
        days_until_expiry: daysUntilExpiry,
        applications_count: batch.applications.length,
      };
    });

    res.json({
      batches: batchesWithStatus,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get batches error:', error);
    res.status(500).json({ error: 'Failed to get batches' });
  }
}

export async function getBatchById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        applications: {
          select: {
            id: true,
            app_number: true,
            app_date: true,
            quantity_used: true,
            trial: {
              select: {
                id: true,
                crop: true,
                farmer: {
                  select: {
                    name: true,
                    location: {
                      select: {
                        village: true,
                        district: true,
                        state: true,
                        pincode: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { app_date: 'desc' },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Add expiry status
    const now = new Date();
    const expiryDate = new Date(batch.expiry_date);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let expiryStatus = 'active';
    if (daysUntilExpiry < 0) {
      expiryStatus = 'expired';
    } else if (daysUntilExpiry <= 30) {
      expiryStatus = 'expiring_soon';
    }

    res.json({
      batch: {
        ...batch,
        expiry_status: expiryStatus,
        days_until_expiry: daysUntilExpiry,
      },
    });
  } catch (error) {
    logger.error('Get batch by ID error:', error);
    res.status(500).json({ error: 'Failed to get batch' });
  }
}

export async function updateBatch(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      batch_number,
      manufacturing_date,
      expiry_date,
      quantity_produced,
      quantity_remaining,
      unit,
      storage_location,
      notes,
      is_active,
    } = req.body;

    // Check if batch exists
    const existingBatch = await prisma.batch.findUnique({ where: { id } });
    if (!existingBatch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Check if new batch number conflicts with existing batch
    if (batch_number && batch_number !== existingBatch.batch_number) {
      const numberExists = await prisma.batch.findUnique({ where: { batch_number } });
      if (numberExists) {
        return res.status(400).json({ error: 'Batch number already exists' });
      }
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (batch_number !== undefined) updateData.batch_number = batch_number;
    if (manufacturing_date !== undefined) updateData.manufacturing_date = new Date(manufacturing_date);
    if (expiry_date !== undefined) updateData.expiry_date = new Date(expiry_date);
    if (quantity_produced !== undefined) updateData.quantity_produced = parseFloat(quantity_produced);
    if (quantity_remaining !== undefined) updateData.quantity_remaining = parseFloat(quantity_remaining);
    if (unit !== undefined) updateData.unit = unit;
    if (storage_location !== undefined) updateData.storage_location = storage_location;
    if (notes !== undefined) updateData.notes = notes;
    if (is_active !== undefined) updateData.is_active = is_active;

    const batch = await prisma.batch.update({
      where: { id },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({ batch });
  } catch (error) {
    logger.error('Update batch error:', error);
    res.status(500).json({ error: 'Failed to update batch' });
  }
}

export async function deleteBatch(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if batch exists and get consumption records
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        applications: { select: { id: true } },
        rm_consumptions: {
          select: {
            id: true,
            raw_material_batch_id: true,
            quantity_consumed: true,
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Check if batch has applications
    if (batch.applications.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete batch with associated applications',
        applicationsCount: batch.applications.length,
      });
    }

    // Use transaction to restore RM stock and delete batch
    await prisma.$transaction(async (tx) => {
      // Restore raw material stock for each consumption
      for (const consumption of batch.rm_consumptions) {
        await tx.rawMaterialBatch.update({
          where: { id: consumption.raw_material_batch_id },
          data: {
            quantity_remaining: {
              increment: consumption.quantity_consumed,
            },
          },
        });

        logger.info(
          `Restored ${consumption.quantity_consumed} to RM batch ${consumption.raw_material_batch_id} after deleting production batch ${batch.batch_number}`
        );
      }

      // Delete the batch (cascade will delete consumptions)
      await tx.batch.delete({ where: { id } });
    });

    res.json({
      message: 'Batch deleted successfully',
      restored_consumptions: batch.rm_consumptions.length,
    });
  } catch (error) {
    logger.error('Delete batch error:', error);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
}

export async function getBatchesByProduct(req: AuthRequest, res: Response) {
  try {
    const { product_id } = req.params;

    // Get only active batches with remaining quantity
    const batches = await prisma.batch.findMany({
      where: {
        product_id,
        is_active: true,
        quantity_remaining: { gt: 0 },
      },
      orderBy: { expiry_date: 'asc' }, // FEFO - First Expiry First Out
      select: {
        id: true,
        batch_number: true,
        quantity_remaining: true,
        unit: true,
        expiry_date: true,
      },
    });

    // Add expiry status for each batch
    const batchesWithStatus = batches.map((batch) => {
      const now = new Date();
      const expiryDate = new Date(batch.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let expiryStatus = 'active';
      if (daysUntilExpiry < 0) {
        expiryStatus = 'expired';
      } else if (daysUntilExpiry <= 30) {
        expiryStatus = 'expiring_soon';
      }

      return {
        ...batch,
        expiry_status: expiryStatus,
        days_until_expiry: daysUntilExpiry,
      };
    });

    res.json({ batches: batchesWithStatus });
  } catch (error) {
    logger.error('Get batches by product error:', error);
    res.status(500).json({ error: 'Failed to get batches' });
  }
}
