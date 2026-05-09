import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function getStockMovements(req: AuthRequest, res: Response) {
  try {
    const {
      raw_material_id,
      movement_type,
      from_date,
      to_date,
      page = '1',
      limit = '20',
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (raw_material_id) {
      where.raw_material_id = String(raw_material_id);
    }

    if (movement_type) {
      where.movement_type = String(movement_type);
    }

    if (from_date || to_date) {
      where.movement_date = {};
      if (from_date) {
        where.movement_date.gte = new Date(String(from_date));
      }
      if (to_date) {
        where.movement_date.lte = new Date(String(to_date));
      }
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take,
        orderBy: { movement_date: 'desc' },
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
          batch: {
            select: {
              id: true,
              batch_number: true,
            },
          },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({
      stock_movements: movements,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get stock movements error:', error);
    res.status(500).json({ error: 'Failed to get stock movements' });
  }
}

export async function getStockMovementById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const movement = await prisma.stockMovement.findUnique({
      where: { id },
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
        batch: {
          select: {
            id: true,
            batch_number: true,
          },
        },
      },
    });

    if (!movement) {
      return res.status(404).json({ error: 'Stock movement not found' });
    }

    res.json({ stock_movement: movement });
  } catch (error) {
    logger.error('Get stock movement by ID error:', error);
    res.status(500).json({ error: 'Failed to get stock movement' });
  }
}
