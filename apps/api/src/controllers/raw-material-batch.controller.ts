import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createRawMaterialBatch(req: AuthRequest, res: Response) {
  try {
    const {
      raw_material_id,
      batch_number,
      receipt_date,
      expiry_date,
      quantity_received,
      unit,
      storage_location,
      quality_parameters,
      quality_status = 'PENDING',
    } = req.body;

    // Validate required fields
    if (!raw_material_id || !batch_number || !receipt_date || !quantity_received || !unit) {
      return res.status(400).json({
        error: 'Raw material ID, batch number, receipt date, quantity, and unit are required',
      });
    }

    // Check if raw material exists
    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { id: raw_material_id },
    });

    if (!rawMaterial) {
      return res.status(404).json({ error: 'Raw material not found' });
    }

    // Check if batch number already exists
    const existingBatch = await prisma.rawMaterialBatch.findUnique({
      where: { batch_number },
    });

    if (existingBatch) {
      return res.status(400).json({ error: 'Batch number already exists' });
    }

    const batch = await prisma.rawMaterialBatch.create({
      data: {
        raw_material_id,
        batch_number,
        receipt_date: new Date(receipt_date),
        expiry_date: expiry_date ? new Date(expiry_date) : null,
        quantity_received,
        quantity_remaining: quantity_received, // Initially, remaining = received
        unit,
        storage_location,
        quality_parameters,
        quality_status,
        created_by: req.user!.userId,
      },
      include: {
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

    res.status(201).json({ batch });
  } catch (error) {
    logger.error('Create raw material batch error:', error);
    res.status(500).json({ error: 'Failed to create raw material batch' });
  }
}

export async function getRawMaterialBatches(req: AuthRequest, res: Response) {
  try {
    const {
      raw_material_id,
      quality_status,
      is_active = 'true',
      has_stock = 'false',
      search,
      page = '1',
      limit = '20',
      sortBy,
      sortOrder,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    // Search by batch number, raw material name/code/category
    if (search) {
      const s = String(search);
      where.OR = [
        { batch_number: { contains: s, mode: 'insensitive' } },
        { storage_location: { contains: s, mode: 'insensitive' } },
        {
          raw_material: {
            OR: [
              { name: { contains: s, mode: 'insensitive' } },
              { code: { contains: s, mode: 'insensitive' } },
              { category: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Filter by raw material
    if (raw_material_id) {
      where.raw_material_id = String(raw_material_id);
    }

    // Filter by quality status
    if (quality_status) {
      where.quality_status = String(quality_status);
    }

    // Filter by active status
    if (is_active !== 'all') {
      where.is_active = is_active === 'true';
    }

    // Filter by stock availability
    if (has_stock === 'true') {
      where.quantity_remaining = { gt: 0 };
    }

    // Server-side sorting
    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      batch_number: { batch_number: sortDir },
      receipt_date: { receipt_date: sortDir },
      quantity_remaining: { quantity_remaining: sortDir },
      quality_status: { quality_status: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { created_at: 'desc' };

    const [batches, total] = await Promise.all([
      prisma.rawMaterialBatch.findMany({
        where,
        skip,
        take,
        orderBy,
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
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
        },
      }),
      prisma.rawMaterialBatch.count({ where }),
    ]);

    res.json({
      rm_batches: batches,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get raw material batches error:', error);
    res.status(500).json({ error: 'Failed to get raw material batches' });
  }
}

export async function getRawMaterialBatchById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const batch = await prisma.rawMaterialBatch.findUnique({
      where: { id },
      include: {
        raw_material: true,
        consumptions: {
          include: {
            finished_batch: {
              select: {
                id: true,
                batch_number: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
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

    if (!batch) {
      return res.status(404).json({ error: 'Raw material batch not found' });
    }

    res.json({ batch });
  } catch (error) {
    logger.error('Get raw material batch by ID error:', error);
    res.status(500).json({ error: 'Failed to get raw material batch' });
  }
}

export async function updateRawMaterialBatch(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      batch_number,
      storage_location,
      quality_parameters,
      quality_status,
      is_active,
    } = req.body;

    // Check if batch exists
    const existing = await prisma.rawMaterialBatch.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Raw material batch not found' });
    }

    // Check if batch number is being changed and if new batch number already exists
    if (batch_number && batch_number !== existing.batch_number) {
      const batchExists = await prisma.rawMaterialBatch.findUnique({
        where: { batch_number },
      });
      if (batchExists) {
        return res.status(400).json({ error: 'Batch number already exists' });
      }
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (batch_number !== undefined) updateData.batch_number = batch_number;
    if (storage_location !== undefined) updateData.storage_location = storage_location;
    if (quality_parameters !== undefined) updateData.quality_parameters = quality_parameters;
    if (quality_status !== undefined) updateData.quality_status = quality_status;
    if (is_active !== undefined) updateData.is_active = is_active;

    const batch = await prisma.rawMaterialBatch.update({
      where: { id },
      data: updateData,
      include: {
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

    res.json({ batch });
  } catch (error) {
    logger.error('Update raw material batch error:', error);
    res.status(500).json({ error: 'Failed to update raw material batch' });
  }
}

export async function deleteRawMaterialBatch(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if batch exists
    const batch = await prisma.rawMaterialBatch.findUnique({
      where: { id },
      include: {
        consumptions: true,
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Raw material batch not found' });
    }

    // Check if batch has been consumed
    if (batch.consumptions.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete raw material batch that has been consumed. Please check consumption records.',
      });
    }

    // Use a transaction to delete the batch and update raw material stock
    await prisma.$transaction(async (tx) => {
      // Decrement the parent raw material's current_stock_quantity by the batch's remaining quantity
      if (batch.quantity_remaining > 0) {
        await tx.rawMaterial.update({
          where: { id: batch.raw_material_id },
          data: {
            current_stock_quantity: {
              decrement: batch.quantity_remaining,
            },
            updated_by: req.user!.userId,
          },
        });
      }

      // Delete any associated stock movements
      await tx.stockMovement.deleteMany({
        where: { batch_id: id },
      });

      await tx.rawMaterialBatch.delete({
        where: { id },
      });
    });

    logger.info(`Raw material batch deleted: ${batch.batch_number}. Stock decremented by ${batch.quantity_remaining}. User: ${req.user!.userId}`);
    res.json({ message: 'Raw material batch deleted successfully' });
  } catch (error) {
    logger.error('Delete raw material batch error:', error);
    res.status(500).json({ error: 'Failed to delete raw material batch' });
  }
}

export async function getAvailableBatches(req: AuthRequest, res: Response) {
  try {
    const { raw_material_id } = req.params;

    // Get all active batches with remaining stock, ordered by expiry (FEFO)
    const batches = await prisma.rawMaterialBatch.findMany({
      where: {
        raw_material_id,
        is_active: true,
        quantity_remaining: { gt: 0 },
      },
      orderBy: [
        { expiry_date: 'asc' }, // First Expiry First Out
        { receipt_date: 'asc' }, // Then oldest first
      ],
      select: {
        id: true,
        batch_number: true,
        quantity_remaining: true,
        unit: true,
        expiry_date: true,
        storage_location: true,
      },
    });

    res.json({ batches });
  } catch (error) {
    logger.error('Get available batches error:', error);
    res.status(500).json({ error: 'Failed to get available batches' });
  }
}

export async function adjustStock(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { quantity_adjustment, reason } = req.body;

    if (quantity_adjustment === undefined || quantity_adjustment === null || !reason) {
      return res.status(400).json({ error: 'Quantity adjustment and reason are required' });
    }

    const adjustmentNum = Number(quantity_adjustment);
    if (isNaN(adjustmentNum)) {
      return res.status(400).json({ error: 'Quantity adjustment must be a valid number' });
    }

    const batch = await prisma.rawMaterialBatch.findUnique({
      where: { id },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Raw material batch not found' });
    }

    const newQuantity = batch.quantity_remaining + adjustmentNum;

    if (newQuantity < 0) {
      return res.status(400).json({
        error: `Cannot adjust stock. Resulting quantity (${newQuantity}) would be negative.`,
      });
    }

    if (newQuantity > batch.quantity_received) {
      return res.status(400).json({
        error: `Cannot adjust stock above received quantity (${batch.quantity_received}).`,
      });
    }

    // Use a transaction to update both batch and raw material stock atomically
    const updatedBatch = await prisma.$transaction(async (tx) => {
      const updated = await tx.rawMaterialBatch.update({
        where: { id },
        data: {
          quantity_remaining: newQuantity,
          updated_by: req.user!.userId,
        },
        include: {
          raw_material: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      // Also update the parent raw material's current_stock_quantity
      if (adjustmentNum > 0) {
        await tx.rawMaterial.update({
          where: { id: batch.raw_material_id },
          data: {
            current_stock_quantity: { increment: adjustmentNum },
            updated_by: req.user!.userId,
          },
        });
      } else if (adjustmentNum < 0) {
        await tx.rawMaterial.update({
          where: { id: batch.raw_material_id },
          data: {
            current_stock_quantity: { decrement: Math.abs(adjustmentNum) },
            updated_by: req.user!.userId,
          },
        });
      }

      return updated;
    });

    logger.info(`Stock adjusted for batch ${batch.batch_number}. Adjustment: ${adjustmentNum}. Reason: ${reason}. User: ${req.user!.userId}`);

    res.json({
      batch: updatedBatch,
      adjustment: {
        previous_quantity: batch.quantity_remaining,
        adjustment: adjustmentNum,
        new_quantity: newQuantity,
        reason,
      },
    });
  } catch (error) {
    logger.error('Adjust stock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
}
