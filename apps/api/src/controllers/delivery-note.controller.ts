import { Response } from 'express';
import { prisma, Prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createDeliveryNoteFromSalesOrder(req: AuthRequest, res: Response) {
  try {
    const { sales_order_id, delivery_date, items, notes } = req.body;

    // Validate required fields
    if (!sales_order_id || !delivery_date || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Sales order, delivery date, and items are required',
      });
    }

    // Get sales order with items
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: sales_order_id },
      include: {
        items: true,
        customer_rel: true,
      },
    });

    if (!salesOrder) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (salesOrder.status === 'DELIVERED' || salesOrder.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Sales order already delivered or cancelled' });
    }

    // Generate DN number: DN-YYYY-###
    const year = new Date(delivery_date).getFullYear();
    const count = await prisma.deliveryNote.count({
      where: {
        dn_number: {
          startsWith: `DN-${year}-`,
        },
      },
    });
    const paddedNumber = String(count + 1).padStart(3, '0');
    let dn_number = `DN-${year}-${paddedNumber}`;

    // Ensure uniqueness
    let suffix = 1;
    while (await prisma.deliveryNote.findUnique({ where: { dn_number } })) {
      dn_number = `DN-${year}-${paddedNumber}-${suffix}`;
      suffix++;
    }

    // Execute in transaction
    const deliveryNote = await prisma.$transaction(async (tx) => {
      // Validate and prepare items
      const itemsToCreate = [];
      for (const item of items) {
        const soItem = salesOrder.items.find((i) => i.id === item.sales_order_item_id);
        if (!soItem) {
          throw new Error(`Sales order item ${item.sales_order_item_id} not found`);
        }

        const quantityToDeliver = item.quantity_delivered != null ? Number(item.quantity_delivered) : Number(soItem.quantity);

        // Check batch availability
        const batch = await tx.rawMaterialBatch.findUnique({
          where: { id: soItem.batch_id },
        });

        if (!batch) {
          throw new Error(`Batch ${soItem.batch_id} not found`);
        }

        if (Number(batch.quantity_remaining) < Number(quantityToDeliver)) {
          throw new Error(
            `Insufficient stock in batch ${batch.batch_number}. Available: ${batch.quantity_remaining}, Requested: ${quantityToDeliver}`
          );
        }

        // Update batch quantity
        await tx.rawMaterialBatch.update({
          where: { id: batch.id },
          data: {
            quantity_remaining: {
              decrement: Number(quantityToDeliver),
            },
          },
        });

        // Update raw material stock
        await tx.rawMaterial.update({
          where: { id: soItem.raw_material_id },
          data: {
            current_stock_quantity: {
              decrement: Number(quantityToDeliver),
            },
          },
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            raw_material_id: soItem.raw_material_id,
            batch_id: batch.id,
            movement_type: 'SALE',
            quantity: Number(quantityToDeliver),
            unit: soItem.unit,
            reference_type: 'SalesOrder',
            reference_id: salesOrder.id,
            movement_date: new Date(delivery_date),
            created_by: req.user!.userId,
          },
        });

        itemsToCreate.push({
          sales_order_item_id: soItem.id,
          raw_material_id: soItem.raw_material_id,
          batch_id: batch.id,
          quantity_delivered: quantityToDeliver,
          unit: soItem.unit,
        });
      }

      // Create delivery note with items
      const dn = await tx.deliveryNote.create({
        data: {
          dn_number,
          sales_order_id: salesOrder.id,
          customer_id: salesOrder.customer_id,
          delivery_date: new Date(delivery_date),
          notes,
          created_by: req.user!.userId,
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          items: {
            include: {
              raw_material: true,
              batch: true,
              sales_order_item: true,
            },
          },
          customer_rel: true,
          sales_order: true,
        },
      });

      // Update sales order status to DELIVERED
      await tx.salesOrder.update({
        where: { id: salesOrder.id },
        data: { status: 'DELIVERED' },
      });

      return dn;
    });

    logger.info(`Delivery note created: ${dn_number}`, { dn_id: deliveryNote.id });
    res.status(201).json({ deliveryNote });
  } catch (error: any) {
    logger.error('Create delivery note error:', error);
    res.status(500).json({ error: error.message || 'Failed to create delivery note' });
  }
}

export async function getDeliveryNotes(req: AuthRequest, res: Response) {
  try {
    const {
      sales_order_id,
      customer_id,
      from_date,
      to_date,
      page = '1',
      limit = '20',
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (sales_order_id) {
      where.sales_order_id = String(sales_order_id);
    }

    if (customer_id) {
      where.customer_id = String(customer_id);
    }

    if (from_date || to_date) {
      where.delivery_date = {};
      if (from_date) {
        where.delivery_date.gte = new Date(String(from_date));
      }
      if (to_date) {
        where.delivery_date.lte = new Date(String(to_date));
      }
    }

    const [deliveryNotes, total] = await Promise.all([
      prisma.deliveryNote.findMany({
        where,
        skip,
        take,
        orderBy: { delivery_date: 'desc' },
        include: {
          customer_rel: {
            select: {
              id: true,
              company_name: true,
              client_name: true,
            },
          },
          sales_order: {
            select: {
              id: true,
              so_number: true,
            },
          },
          items: {
            select: {
              id: true,
              quantity_delivered: true,
              unit: true,
            },
          },
        },
      }),
      prisma.deliveryNote.count({ where }),
    ]);

    res.json({
      deliveryNotes,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get delivery notes error:', error);
    res.status(500).json({ error: 'Failed to get delivery notes' });
  }
}

export async function getDeliveryNoteById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const deliveryNote = await prisma.deliveryNote.findUnique({
      where: { id },
      include: {
        customer_rel: true,
        sales_order: {
          include: {
            items: true,
          },
        },
        items: {
          include: {
            raw_material: true,
            batch: true,
            sales_order_item: true,
          },
        },
      },
    });

    if (!deliveryNote) {
      return res.status(404).json({ error: 'Delivery note not found' });
    }

    res.json({ deliveryNote });
  } catch (error) {
    logger.error('Get delivery note by ID error:', error);
    res.status(500).json({ error: 'Failed to get delivery note' });
  }
}
