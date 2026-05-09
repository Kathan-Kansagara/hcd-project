import { Response } from 'express';
import { prisma, Prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createSalesOrder(req: AuthRequest, res: Response) {
  try {
    const {
      sale_type = 'company',
      customer_id,
      order_date,
      expected_delivery_date,
      payment_method,
      discount_amount = 0,
      discount_percentage = 0,
      items,
      notes,
    } = req.body;

    // Validate required fields
    if (!customer_id || !order_date || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Customer, order date and at least one item are required',
      });
    }

    // Validate sale type
    if (sale_type !== 'company' && sale_type !== 'individual') {
      return res.status(400).json({ error: 'Invalid sale type. Must be "company" or "individual"' });
    }

    // Check if customer exists
    const customer = await prisma.customer.findUnique({ where: { id: customer_id } });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Validate items
    for (const item of items) {
      if (!item.raw_material_id || !item.batch_id || !item.quantity || !item.unit_price || item.gst_rate === undefined) {
        return res.status(400).json({
          error: 'Each item must have raw_material_id, batch_id, quantity, unit_price, and gst_rate',
        });
      }
    }

    // Validate stock availability for each item
    for (const item of items) {
      const batch = await prisma.rawMaterialBatch.findUnique({
        where: { id: item.batch_id },
        select: { quantity_remaining: true, raw_material_id: true },
      });

      if (!batch) {
        return res.status(404).json({ error: `Batch ${item.batch_id} not found` });
      }

      if (batch.raw_material_id !== item.raw_material_id) {
        return res.status(400).json({
          error: `Batch ${item.batch_id} does not belong to raw material ${item.raw_material_id}`,
        });
      }

      if (Number(batch.quantity_remaining) < Number(item.quantity)) {
        return res.status(400).json({
          error: `Insufficient stock for item. Available: ${batch.quantity_remaining}, Requested: ${item.quantity}`,
        });
      }
    }

    // Generate SO number: SO-YYYY-###
    const year = new Date(order_date).getFullYear();
    const count = await prisma.salesOrder.count({
      where: {
        so_number: {
          startsWith: `SO-${year}-`,
        },
      },
    });
    const paddedNumber = String(count + 1).padStart(3, '0');
    let so_number = `SO-${year}-${paddedNumber}`;

    // Ensure uniqueness
    let suffix = 1;
    while (await prisma.salesOrder.findUnique({ where: { so_number } })) {
      so_number = `SO-${year}-${paddedNumber}-${suffix}`;
      suffix++;
    }

    // Fetch raw materials to get product names and HSN codes
    const rawMaterialIds = items.map((item: any) => item.raw_material_id);
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: { id: { in: rawMaterialIds } },
      select: { id: true, name: true, hsn_sac_code: true, unit: true },
    });

    const rmMap = new Map(rawMaterials.map((rm) => [rm.id, rm]));

    // Calculate line item amounts
    const itemsWithCalculations = items.map((item: any) => {
      const rm = rmMap.get(item.raw_material_id);
      const amount = Number(item.quantity) * Number(item.unit_price);
      const gst_amount = amount * (Number(item.gst_rate) / 100);
      const total_amount = amount + gst_amount;

      return {
        raw_material_id: item.raw_material_id,
        batch_id: item.batch_id,
        product_name: rm?.name || 'Unknown',
        hsn_sac_code: rm?.hsn_sac_code || '',
        quantity: item.quantity,
        unit: rm?.unit || item.unit || 'LITER',
        unit_price: item.unit_price,
        gst_rate: item.gst_rate,
        amount,
        gst_amount,
        total_amount,
      };
    });

    // Create SO with items
    const salesOrder = await prisma.salesOrder.create({
      data: {
        so_number,
        sale_type,
        customer_id,
        order_date: new Date(order_date),
        expected_delivery_date: expected_delivery_date ? new Date(expected_delivery_date) : null,
        status: 'PENDING',
        payment_method: payment_method || null,
        discount_amount: discount_amount || 0,
        discount_percentage: discount_percentage || 0,
        notes,
        created_by: req.user!.userId,
        items: {
          create: itemsWithCalculations,
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
            batch: {
              select: {
                id: true,
                batch_number: true,
                quantity_remaining: true,
              },
            },
          },
        },
        customer_rel: {
          select: {
            id: true,
            company_name: true,
            client_name: true,
            contact: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Sales order created: ${so_number} (${sale_type})`, { so_id: salesOrder.id });
    res.status(201).json({ salesOrder });
  } catch (error) {
    logger.error('Create sales order error:', error);
    res.status(500).json({ error: 'Failed to create sales order' });
  }
}

export async function getSalesOrders(req: AuthRequest, res: Response) {
  try {
    const {
      customer_id,
      status,
      sale_type,
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

    // Filter by customer
    if (customer_id) {
      where.customer_id = String(customer_id);
    }

    // Filter by status
    if (status) {
      where.status = String(status);
    }

    // Filter by sale type
    if (sale_type) {
      where.sale_type = String(sale_type);
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

    // Search by SO number, customer name
    if (search) {
      where.OR = [
        { so_number: { contains: String(search), mode: 'insensitive' } },
        { customer_rel: { company_name: { contains: String(search), mode: 'insensitive' } } },
        { customer_rel: { client_name: { contains: String(search), mode: 'insensitive' } } },
        { notes: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    // Server-side sorting
    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      so_number: { so_number: sortDir },
      order_date: { order_date: sortDir },
      status: { status: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { order_date: 'desc' };

    const [salesOrders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          customer_rel: {
            select: {
              id: true,
              customer_type: true,
              company_name: true,
              client_name: true,
              contact: true,
              email: true,
            },
          },
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
          items: {
            select: {
              id: true,
              product_name: true,
              quantity: true,
              unit: true,
              unit_price: true,
              amount: true,
              gst_amount: true,
              total_amount: true,
            },
          },
          invoices: {
            select: {
              id: true,
              invoice_number: true,
              status: true,
            },
            orderBy: { created_at: 'desc' },
          },
        },
      }),
      prisma.salesOrder.count({ where }),
    ]);

    // Calculate totals for each SO
    const salesOrdersWithTotals = salesOrders.map((so) => {
      const sub_total = so.items.reduce((sum, item) => sum + Number(item.amount), 0);
      const total_gst = so.items.reduce((sum, item) => sum + Number(item.gst_amount), 0);
      const grand_total = so.items.reduce((sum, item) => sum + Number(item.total_amount), 0);

      return {
        ...so,
        sub_total,
        total_gst,
        grand_total,
      };
    });

    res.json({
      salesOrders: salesOrdersWithTotals,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get sales orders error:', error);
    res.status(500).json({ error: 'Failed to get sales orders' });
  }
}

export async function getSalesOrderById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer_rel: {
          select: {
            id: true,
            company_name: true,
            client_name: true,
            contact: true,
            email: true,
            address_line1: true,
            address_line2: true,
            gstin: true,
            place_of_supply: true,
            payment_terms: true,
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
                quantity_remaining: true,
              },
            },
          },
        },
      },
    });

    if (!salesOrder) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    // Calculate totals
    const sub_total = salesOrder.items.reduce((sum, item) => sum + Number(item.amount), 0);
    const total_gst = salesOrder.items.reduce((sum, item) => sum + Number(item.gst_amount), 0);
    const grand_total = salesOrder.items.reduce((sum, item) => sum + Number(item.total_amount), 0);

    res.json({
      salesOrder: {
        ...salesOrder,
        sub_total,
        total_gst,
        grand_total,
      },
    });
  } catch (error) {
    logger.error('Get sales order by ID error:', error);
    res.status(500).json({ error: 'Failed to get sales order' });
  }
}

export async function updateSalesOrder(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      customer_id,
      sale_type,
      order_date,
      expected_delivery_date,
      payment_method,
      discount_amount,
      discount_percentage,
      notes,
    } = req.body;

    // Check if SO exists
    const existingSO = await prisma.salesOrder.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existingSO) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    // Only allow updates if status is PENDING
    if (existingSO.status !== 'PENDING') {
      return res.status(400).json({ error: 'Cannot update sales order with status ' + existingSO.status });
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };
    if (sale_type) updateData.sale_type = sale_type;
    if (customer_id) updateData.customer_id = customer_id;
    if (order_date) updateData.order_date = new Date(order_date);
    if (expected_delivery_date !== undefined) {
      updateData.expected_delivery_date = expected_delivery_date ? new Date(expected_delivery_date) : null;
    }
    if (payment_method !== undefined) updateData.payment_method = payment_method;
    if (discount_amount !== undefined) updateData.discount_amount = discount_amount;
    if (discount_percentage !== undefined) updateData.discount_percentage = discount_percentage;
    if (notes !== undefined) updateData.notes = notes;

    const salesOrder = await prisma.salesOrder.update({
      where: { id },
      data: updateData,
      include: {
        customer_rel: true,
        items: {
          include: {
            raw_material: true,
            batch: true,
          },
        },
      },
    });

    logger.info(`Sales order updated: ${salesOrder.so_number}`, { so_id: id });
    res.json({ salesOrder });
  } catch (error) {
    logger.error('Update sales order error:', error);
    res.status(500).json({ error: 'Failed to update sales order' });
  }
}

export async function cancelSalesOrder(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if SO exists
    const existingSO = await prisma.salesOrder.findUnique({
      where: { id },
      select: { status: true, so_number: true },
    });

    if (!existingSO) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    // Only allow cancellation if status is PENDING
    if (existingSO.status !== 'PENDING') {
      return res.status(400).json({ error: 'Cannot cancel sales order with status ' + existingSO.status });
    }

    await prisma.salesOrder.update({
      where: { id },
      data: { status: 'CANCELLED', updated_by: req.user!.userId },
    });

    logger.info(`Sales order cancelled: ${existingSO.so_number}`, { so_id: id });
    res.json({ message: 'Sales order cancelled successfully' });
  } catch (error) {
    logger.error('Cancel sales order error:', error);
    res.status(500).json({ error: 'Failed to cancel sales order' });
  }
}

export async function markDelivered(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Get sales order with items
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!salesOrder) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (salesOrder.status === 'DELIVERED') {
      return res.status(400).json({ error: 'Sales order is already delivered' });
    }

    if (salesOrder.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot deliver a cancelled sales order' });
    }

    // Execute in transaction - reduce stock and mark as delivered
    const updatedSO = await prisma.$transaction(async (tx) => {
      for (const item of salesOrder.items) {
        // Check batch availability
        const batch = await tx.rawMaterialBatch.findUnique({
          where: { id: item.batch_id },
        });

        if (!batch) {
          throw new Error(`Batch ${item.batch_id} not found`);
        }

        if (Number(batch.quantity_remaining) < Number(item.quantity)) {
          throw new Error(
            `Insufficient stock in batch ${batch.batch_number}. Available: ${batch.quantity_remaining}, Requested: ${item.quantity}`
          );
        }

        // Update batch quantity
        await tx.rawMaterialBatch.update({
          where: { id: batch.id },
          data: {
            quantity_remaining: {
              decrement: Number(item.quantity),
            },
          },
        });

        // Update raw material stock
        await tx.rawMaterial.update({
          where: { id: item.raw_material_id },
          data: {
            current_stock_quantity: {
              decrement: Number(item.quantity),
            },
          },
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            raw_material_id: item.raw_material_id,
            batch_id: batch.id,
            movement_type: 'SALE',
            quantity: Number(item.quantity),
            unit: item.unit,
            reference_type: 'SalesOrder',
            reference_id: salesOrder.id,
            movement_date: new Date(),
            created_by: req.user!.userId,
          },
        });
      }

      // Update sales order status to DELIVERED
      const updated = await tx.salesOrder.update({
        where: { id },
        data: { status: 'DELIVERED', updated_by: req.user!.userId },
        include: {
          customer_rel: {
            select: {
              id: true,
              company_name: true,
              client_name: true,
            },
          },
          items: {
            include: {
              raw_material: true,
              batch: true,
            },
          },
        },
      });

      return updated;
    });

    logger.info(`Sales order marked as delivered: ${salesOrder.so_number}`, { so_id: id });
    res.json({ salesOrder: updatedSO });
  } catch (error: any) {
    logger.error('Mark delivered error:', error);
    res.status(500).json({ error: error.message || 'Failed to mark as delivered' });
  }
}
