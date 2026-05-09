import { Response } from 'express';
import { prisma, Prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createPurchaseOrder(req: AuthRequest, res: Response) {
  try {
    const { supplier_id, order_date, expected_delivery_date, payment_method, items, notes } = req.body;

    // Validate required fields
    if (!supplier_id || !order_date || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Supplier, order date, and at least one item are required',
      });
    }

    // Validate items
    for (const item of items) {
      if (!item.raw_material_id || !item.quantity || !item.unit || !item.unit_price) {
        return res.status(400).json({
          error: 'Each item must have raw_material_id, quantity, unit, and unit_price',
        });
      }
    }

    // Check if supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id: supplier_id } });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Generate PO number: PO-YYYY-###
    const year = new Date(order_date).getFullYear();
    const count = await prisma.purchaseOrder.count({
      where: {
        po_number: {
          startsWith: `PO-${year}-`,
        },
      },
    });
    const paddedNumber = String(count + 1).padStart(3, '0');
    let po_number = `PO-${year}-${paddedNumber}`;

    // Ensure uniqueness
    let suffix = 1;
    while (await prisma.purchaseOrder.findUnique({ where: { po_number } })) {
      po_number = `PO-${year}-${paddedNumber}-${suffix}`;
      suffix++;
    }

    // Create PO with items
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        po_number,
        supplier_id,
        order_date: new Date(order_date),
        expected_delivery_date: expected_delivery_date ? new Date(expected_delivery_date) : null,
        status: 'PENDING',
        payment_method: payment_method || null,
        notes,
        created_by: req.user!.userId,
        items: {
          create: items.map((item: any) => ({
            raw_material_id: item.raw_material_id,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
          })),
        },
      },
      include: {
        items: {
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
        },
        supplier_rel: {
          select: {
            id: true,
            company_name: true,
            contact: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Purchase order created: ${po_number}`, { po_id: purchaseOrder.id });
    res.status(201).json({ purchase_order: purchaseOrder });
  } catch (error) {
    logger.error('Create purchase order error:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
}

export async function getPurchaseOrders(req: AuthRequest, res: Response) {
  try {
    const {
      supplier_id,
      status,
      from_date,
      to_date,
      search,
      page = '1',
      limit = '20',
      sortBy,
      sortOrder,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    // Search by PO number, supplier company name, notes
    if (search) {
      const s = String(search);
      where.OR = [
        { po_number: { contains: s, mode: 'insensitive' } },
        { notes: { contains: s, mode: 'insensitive' } },
        {
          supplier_rel: {
            company_name: { contains: s, mode: 'insensitive' },
          },
        },
      ];
    }

    // Filter by supplier
    if (supplier_id) {
      where.supplier_id = String(supplier_id);
    }

    // Filter by status
    if (status) {
      where.status = String(status);
    }

    // Filter by date range
    if (from_date || to_date) {
      where.order_date = {};
      if (from_date) {
        where.order_date.gte = new Date(String(from_date));
      }
      if (to_date) {
        where.order_date.lte = new Date(String(to_date));
      }
    }

    // Server-side sorting
    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      po_number: { po_number: sortDir },
      order_date: { order_date: sortDir },
      status: { status: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { order_date: 'desc' };

    const [rawPurchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          supplier_rel: {
            select: {
              id: true,
              company_name: true,
              contact: true,
              email: true,
            },
          },
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
          items: {
            select: {
              id: true,
              raw_material_id: true,
              quantity: true,
              unit: true,
              unit_price: true,
              total_price: true,
              raw_material: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    // Transform response to include computed totals and rename supplier_rel to supplier
    const purchase_orders = rawPurchaseOrders.map((po: any) => {
      const sub_total = po.items.reduce((sum: number, item: any) => sum + Number(item.total_price), 0);
      const { supplier_rel, ...rest } = po;
      return {
        ...rest,
        supplier: supplier_rel,
        sub_total,
        total_amount: sub_total,
      };
    });

    res.json({
      purchase_orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get purchase orders error:', error);
    res.status(500).json({ error: 'Failed to get purchase orders' });
  }
}

export async function getPurchaseOrderById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier_rel: {
          select: {
            id: true,
            company_name: true,
            contact_person: true,
            contact: true,
            email: true,
            address_line1: true,
            address_line2: true,
            gstin: true,
            location: {
              select: {
                city: true,
                district: true,
                state: true,
                pincode: true,
              },
            },
          },
        },
        items: {
          include: {
            raw_material: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                unit: true,
                hsn_sac_code: true,
              },
            },
            batch: {
              select: {
                id: true,
                batch_number: true,
                quantity_received: true,
                quantity_remaining: true,
                receipt_date: true,
              },
            },
          },
        },
      },
    });

    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json({ purchase_order: purchaseOrder });
  } catch (error) {
    logger.error('Get purchase order by ID error:', error);
    res.status(500).json({ error: 'Failed to get purchase order' });
  }
}

export async function updatePurchaseOrder(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { supplier_id, order_date, expected_delivery_date, payment_method, notes, items } = req.body;

    // Check if PO exists and is still pending
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (existing.status !== 'PENDING') {
      return res.status(400).json({
        error: 'Cannot update purchase order that is not in PENDING status',
      });
    }

    // Validate items if provided
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          error: 'At least one item is required',
        });
      }

      for (const item of items) {
        if (!item.raw_material_id || !item.quantity || !item.unit || !item.unit_price) {
          return res.status(400).json({
            error: 'Each item must have raw_material_id, quantity, unit, and unit_price',
          });
        }
      }
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (supplier_id !== undefined) updateData.supplier_id = supplier_id;
    if (order_date !== undefined) updateData.order_date = new Date(order_date);
    if (expected_delivery_date !== undefined) {
      updateData.expected_delivery_date = expected_delivery_date
        ? new Date(expected_delivery_date)
        : null;
    }
    if (payment_method !== undefined) updateData.payment_method = payment_method;
    if (notes !== undefined) updateData.notes = notes;

    // Update items if provided
    if (items !== undefined) {
      // Delete existing items and create new ones
      updateData.items = {
        deleteMany: {},
        create: items.map((item: any) => ({
          raw_material_id: item.raw_material_id,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
        })),
      };
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            raw_material: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        supplier_rel: {
          select: {
            id: true,
            company_name: true,
            contact: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Purchase order updated: ${purchaseOrder.po_number}`, { po_id: id });
    res.json({ purchase_order: purchaseOrder });
  } catch (error) {
    logger.error('Update purchase order error:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
}

export async function markReceived(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { received_date } = req.body;

    // Use today's date if not provided
    const receiptDate = received_date ? new Date(received_date) : new Date();

    // Check if PO exists
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            raw_material: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (purchaseOrder.status !== 'PENDING') {
      return res.status(400).json({
        error: 'Purchase order has already been received or cancelled',
      });
    }

    // Auto-generate batch information from PO items
    const batches = purchaseOrder.items.map((item) => {
      // Generate batch number: PO-{PO_NUMBER}-{RAW_MATERIAL_CODE}
      const batchNumber = `${purchaseOrder.po_number}-${item.raw_material.code}`;
      return {
        raw_material_id: item.raw_material_id,
        batch_number: batchNumber,
        quantity: Number(item.quantity),
        unit: item.unit,
      };
    });

    // Check if any batch numbers already exist
    for (const batch of batches) {
      const existingBatch = await prisma.rawMaterialBatch.findUnique({
        where: { batch_number: batch.batch_number },
      });
      if (existingBatch) {
        return res.status(400).json({
          error: `Batch number ${batch.batch_number} already exists. This PO may have already been received.`,
        });
      }
    }

    // Process receipt in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update PO status
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED', updated_by: req.user!.userId },
      });

      const createdBatches = [];
      const createdMovements = [];

      // Process each batch
      for (const batchData of batches) {
        // Find the corresponding PO item
        const poItem = purchaseOrder.items.find(
          (item) => item.raw_material_id === batchData.raw_material_id
        );

        if (!poItem) {
          throw new Error(
            `Raw material ${batchData.raw_material_id} not found in purchase order`
          );
        }

        // Get current raw material data
        const rawMaterial = await tx.rawMaterial.findUnique({
          where: { id: batchData.raw_material_id },
        });

        if (!rawMaterial) {
          throw new Error(`Raw material ${batchData.raw_material_id} not found`);
        }

        // Create batch
        const batch = await tx.rawMaterialBatch.create({
          data: {
            raw_material_id: batchData.raw_material_id,
            batch_number: batchData.batch_number,
            receipt_date: receiptDate,
            expiry_date: null, // No expiry date by default
            quantity_received: batchData.quantity,
            quantity_remaining: batchData.quantity,
            unit: batchData.unit as any,
            storage_location: null, // No storage location by default
            quality_status: 'APPROVED', // Auto-approved (quality check removed)
            created_by: req.user!.userId,
          },
        });

        createdBatches.push(batch);

        // Update PO item with batch_id
        await tx.purchaseOrderItem.updateMany({
          where: {
            purchase_order_id: id,
            raw_material_id: batchData.raw_material_id,
          },
          data: {
            batch_id: batch.id,
          },
        });

        // Calculate weighted average cost
        const prevStock = rawMaterial.current_stock_quantity.toNumber();
        const prevCost = rawMaterial.weighted_average_cost.toNumber();
        const newStock = batchData.quantity;
        const newCost = poItem.unit_price.toNumber();

        let newWeightedAvgCost: number;
        if (prevStock === 0) {
          // First purchase
          newWeightedAvgCost = newCost;
        } else {
          // Calculate weighted average: ((prev_stock × prev_cost) + (new_stock × new_cost)) / (prev_stock + new_stock)
          newWeightedAvgCost =
            (prevStock * prevCost + newStock * newCost) / (prevStock + newStock);
        }

        // Update raw material stock and weighted average cost
        await tx.rawMaterial.update({
          where: { id: batchData.raw_material_id },
          data: {
            current_stock_quantity: {
              increment: batchData.quantity,
            },
            weighted_average_cost: new Prisma.Decimal(newWeightedAvgCost),
            updated_by: req.user!.userId,
          },
        });

        // Create stock movement record
        const movement = await tx.stockMovement.create({
          data: {
            movement_type: 'PURCHASE',
            raw_material_id: batchData.raw_material_id,
            batch_id: batch.id,
            quantity: batchData.quantity,
            unit: batchData.unit,
            reference_type: 'PurchaseOrder',
            reference_id: id,
            movement_date: receiptDate,
            created_by: req.user!.userId,
          },
        });

        createdMovements.push(movement);
      }

      return { createdBatches, createdMovements };
    });

    logger.info(`Purchase order marked as received: ${purchaseOrder.po_number}`, {
      po_id: id,
      batches_created: result.createdBatches.length,
    });

    // Fetch updated PO with all details
    const updatedPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            raw_material: true,
            batch: true,
          },
        },
        supplier_rel: true,
      },
    });

    res.json({
      purchase_order: updatedPO,
      batches_created: result.createdBatches.length,
      stock_movements_created: result.createdMovements.length,
    });
  } catch (error) {
    logger.error('Mark purchase order as received error:', error);
    res.status(500).json({ error: 'Failed to mark purchase order as received' });
  }
}

export async function cancelPurchaseOrder(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if PO exists with items for stock reversal
    const existing = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            raw_material: true,
            batch: true,
          },
        },
      },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Cannot cancel an already cancelled order
    if (existing.status === 'CANCELLED') {
      return res.status(400).json({
        error: 'Purchase order is already cancelled',
      });
    }

    // ADMIN users can cancel any order (including RECEIVED)
    // Non-ADMIN users can only cancel PENDING orders
    if (req.user!.role !== 'ADMIN' && existing.status !== 'PENDING') {
      return res.status(403).json({
        error: 'Only ADMIN users can cancel non-PENDING purchase orders',
      });
    }

    // If the PO was RECEIVED, we need to reverse stock changes in a transaction
    if (existing.status === 'RECEIVED') {
      await prisma.$transaction(async (tx) => {
        // Update PO status
        await tx.purchaseOrder.update({
          where: { id },
          data: { status: 'CANCELLED', updated_by: req.user!.userId },
        });

        for (const item of existing.items) {
          // Decrement raw material stock
          await tx.rawMaterial.update({
            where: { id: item.raw_material_id },
            data: {
              current_stock_quantity: {
                decrement: Number(item.quantity),
              },
              updated_by: req.user!.userId,
            },
          });

          // Delete the associated batch if it was created during receiving
          if (item.batch_id) {
            // Check if the batch has been consumed before deleting
            const consumptions = await tx.rawMaterialConsumption.findMany({
              where: { raw_material_batch_id: item.batch_id },
            });

            if (consumptions.length > 0) {
              throw new Error(
                `Cannot cancel: batch ${item.batch?.batch_number || item.batch_id} has already been consumed in production.`
              );
            }

            // Delete stock movements for this batch
            await tx.stockMovement.deleteMany({
              where: {
                reference_type: 'PurchaseOrder',
                reference_id: id,
                batch_id: item.batch_id,
              },
            });

            // Delete the batch
            await tx.rawMaterialBatch.delete({
              where: { id: item.batch_id },
            });

            // Clear the batch_id on the PO item
            await tx.purchaseOrderItem.update({
              where: { id: item.id },
              data: { batch_id: null },
            });
          }
        }
      });
    } else {
      // For PENDING orders, just update status
      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED', updated_by: req.user!.userId },
      });
    }

    // Fetch updated PO
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            raw_material: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        supplier_rel: {
          select: {
            id: true,
            company_name: true,
          },
        },
      },
    });

    logger.info(`Purchase order cancelled: ${purchaseOrder!.po_number}`, { po_id: id, cancelled_by: req.user!.userId, was_received: existing.status === 'RECEIVED' });
    res.json({ purchase_order: purchaseOrder });
  } catch (error: any) {
    logger.error('Cancel purchase order error:', error);
    if (error.message?.startsWith('Cannot cancel:')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to cancel purchase order' });
  }
}
