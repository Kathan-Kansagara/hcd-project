import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function getDashboardStats(req: AuthRequest, res: Response) {
  try {
    // Get total trials count (excluding archived)
    const totalTrials = await prisma.trial.count({
      where: {
        NOT: { status: 'ARCHIVED' }
      },
    });

    // Get completed trials count
    const completedTrials = await prisma.trial.count({
      where: { status: 'COMPLETED' },
    });

    // Get in-progress trials count
    const inProgressTrials = await prisma.trial.count({
      where: { status: 'IN_PROGRESS' },
    });

    // Get total farmers count
    const totalFarmers = await prisma.farmer.count();

    // Get active batches count
    const activeBatches = await prisma.batch.count({
      where: { is_active: true },
    });

    // Get expiring soon batches (within 30 days)
    const expiringSoon = await prisma.batch.count({
      where: {
        is_active: true,
        expiry_date: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    });

    // Get low stock items
    const lowStock = await prisma.batch.count({
      where: {
        is_active: true,
        quantity_remaining: {
          lt: 10,
        },
      },
    });

    // Get total stock
    const batches = await prisma.batch.findMany({
      where: { is_active: true },
      select: { quantity_remaining: true },
    });
    const totalStock = batches.reduce((sum, b) => sum + Number(b.quantity_remaining), 0);

    res.json({
      totalTrials,
      inProgressTrials,
      completedTrials,
      totalFarmers,
      activeBatches,
      expiringSoon,
      lowStock,
      totalStock,
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard statistics' });
  }
}

export async function getInventoryAnalytics(req: AuthRequest, res: Response) {
  try {
    const { period = '30' } = req.query;
    const daysAgo = parseInt(String(period));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Total raw materials count
    const totalRawMaterials = await prisma.rawMaterial.count({
      where: { is_active: true },
    });

    // Low stock items (below min_stock_level_inventory)
    // Fetch all active raw materials and filter in-memory since field-level comparison
    // requires the `fieldReference` preview feature which is not enabled
    const allActiveRawMaterials = await prisma.rawMaterial.findMany({
      where: { is_active: true },
      select: {
        current_stock_quantity: true,
        min_stock_level_inventory: true,
      },
    });
    const lowStockItems = allActiveRawMaterials.filter(
      (rm) =>
        rm.min_stock_level_inventory !== null &&
        Number(rm.current_stock_quantity) < Number(rm.min_stock_level_inventory)
    ).length;

    // Total stock value (weighted average cost * quantity)
    const stockValueData = await prisma.rawMaterial.findMany({
      where: { is_active: true },
      select: {
        current_stock_quantity: true,
        weighted_average_cost: true,
      },
    });

    const totalStockValue = stockValueData.reduce((sum, item) => {
      return sum + Number(item.current_stock_quantity) * Number(item.weighted_average_cost);
    }, 0);

    // Recent stock movements count
    const recentMovements = await prisma.stockMovement.count({
      where: {
        created_at: {
          gte: startDate,
        },
      },
    });

    // Stock movements by type
    const movementsByType = await prisma.stockMovement.groupBy({
      by: ['movement_type'],
      where: {
        created_at: {
          gte: startDate,
        },
      },
      _count: true,
      _sum: {
        quantity: true,
      },
    });

    res.json({
      total_raw_materials: totalRawMaterials,
      low_stock_items: lowStockItems,
      total_stock_value: totalStockValue,
      recent_movements: recentMovements,
      movements_by_type: movementsByType.map((m) => ({
        type: m.movement_type,
        count: m._count,
        total_quantity: Number(m._sum.quantity || 0),
      })),
    });
  } catch (error) {
    logger.error('Get inventory analytics error:', error);
    res.status(500).json({ error: 'Failed to get inventory analytics' });
  }
}

export async function getSalesAnalytics(req: AuthRequest, res: Response) {
  try {
    const { period = '30' } = req.query;
    const daysAgo = parseInt(String(period));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Total sales orders
    const totalOrders = await prisma.salesOrder.count({
      where: {
        order_date: {
          gte: startDate,
        },
      },
    });

    // Orders by status
    const ordersByStatus = await prisma.salesOrder.groupBy({
      by: ['status'],
      where: {
        order_date: {
          gte: startDate,
        },
      },
      _count: true,
    });

    // Total revenue from invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        invoice_date: {
          gte: startDate,
        },
      },
      select: {
        grand_total: true,
        status: true,
      },
    });

    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.grand_total), 0);
    const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + Number(inv.grand_total), 0);
    const totalOutstanding = totalRevenue - totalPaid;

    // Top customers by revenue
    const topCustomers = await prisma.invoice.groupBy({
      by: ['customer_id'],
      where: {
        invoice_date: {
          gte: startDate,
        },
      },
      _sum: {
        grand_total: true,
      },
      orderBy: {
        _sum: {
          grand_total: 'desc',
        },
      },
      take: 5,
    });

    const topCustomersWithDetails = await Promise.all(
      topCustomers.map(async (tc) => {
        const customer = await prisma.customer.findUnique({
          where: { id: tc.customer_id },
          select: { company_name: true, client_name: true },
        });
        return {
          customer_id: tc.customer_id,
          customer_name: customer?.company_name || customer?.client_name || 'Unknown',
          total_revenue: Number(tc._sum.grand_total || 0),
        };
      })
    );

    res.json({
      total_orders: totalOrders,
      orders_by_status: ordersByStatus.map((o) => ({
        status: o.status,
        count: o._count,
        total_value: 0, // Sales orders don't have grand_total, use invoices instead
      })),
      total_revenue: totalRevenue,
      total_paid: totalPaid,
      total_outstanding: totalOutstanding,
      top_customers: topCustomersWithDetails,
    });
  } catch (error) {
    logger.error('Get sales analytics error:', error);
    res.status(500).json({ error: 'Failed to get sales analytics' });
  }
}

export async function getPurchaseAnalytics(req: AuthRequest, res: Response) {
  try {
    const { period = '30' } = req.query;
    const daysAgo = parseInt(String(period));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Total purchase orders
    const totalPOs = await prisma.purchaseOrder.count({
      where: {
        order_date: {
          gte: startDate,
        },
      },
    });

    // POs by status
    const posByStatus = await prisma.purchaseOrder.groupBy({
      by: ['status'],
      where: {
        order_date: {
          gte: startDate,
        },
      },
      _count: true,
    });

    // Total purchase value (set to 0 as POs don't have grand_total)
    const totalPurchaseValue = 0;

    // Top suppliers by purchase count (since POs don't have grand_total)
    const topSuppliers = await prisma.purchaseOrder.groupBy({
      by: ['supplier_id'],
      where: {
        order_date: {
          gte: startDate,
        },
      },
      _count: true,
      orderBy: {
        _count: {
          supplier_id: 'desc',
        },
      },
      take: 5,
    });

    const topSuppliersWithDetails = await Promise.all(
      topSuppliers.map(async (ts) => {
        const supplier = await prisma.supplier.findUnique({
          where: { id: ts.supplier_id },
          select: { company_name: true },
        });
        return {
          supplier_id: ts.supplier_id,
          supplier_name: supplier?.company_name || 'Unknown',
          total_purchase: 0, // POs don't have grand_total field
        };
      })
    );

    res.json({
      total_purchase_orders: totalPOs,
      pos_by_status: posByStatus.map((po) => ({
        status: po.status,
        count: po._count,
        total_value: 0, // Purchase orders don't have grand_total
      })),
      total_purchase_value: totalPurchaseValue,
      top_suppliers: topSuppliersWithDetails,
    });
  } catch (error) {
    logger.error('Get purchase analytics error:', error);
    res.status(500).json({ error: 'Failed to get purchase analytics' });
  }
}

export async function getInventoryProductionOverview(req: AuthRequest, res: Response) {
  try {
    const { period = '90' } = req.query;
    const daysAgo = parseInt(String(period));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // --- Summary Stats ---

    // Total products count
    const totalProducts = await prisma.product.count();

    // Total raw materials count
    const totalRawMaterials = await prisma.rawMaterial.count({
      where: { is_active: true },
    });

    // Active finished product batches
    const totalFinishedBatches = await prisma.batch.count({
      where: { is_active: true },
    });

    // Active RM batches
    const totalRMBatches = await prisma.rawMaterialBatch.count({
      where: { is_active: true },
    });

    // Total finished product stock
    const finishedBatches = await prisma.batch.findMany({
      where: { is_active: true },
      select: { quantity_remaining: true, quantity_produced: true },
    });
    const totalFinishedStock = finishedBatches.reduce(
      (sum, b) => sum + Number(b.quantity_remaining),
      0
    );
    const totalProducedStock = finishedBatches.reduce(
      (sum, b) => sum + Number(b.quantity_produced),
      0
    );

    // Total raw material stock value
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        unit: true,
        current_stock_quantity: true,
        weighted_average_cost: true,
        min_stock_level_inventory: true,
      },
    });

    const totalRMStockValue = rawMaterials.reduce((sum, rm) => {
      return sum + Number(rm.current_stock_quantity) * Number(rm.weighted_average_cost);
    }, 0);

    // Low stock raw materials (below min level)
    const lowStockRawMaterials = rawMaterials.filter(
      (rm) =>
        rm.min_stock_level_inventory &&
        Number(rm.current_stock_quantity) < Number(rm.min_stock_level_inventory)
    );

    // Expiring finished batches (within 30 days)
    const expiringFinishedBatches = await prisma.batch.findMany({
      where: {
        is_active: true,
        expiry_date: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
      include: { product: { select: { name: true } } },
      orderBy: { expiry_date: 'asc' },
      take: 10,
    });

    // Expiring RM batches (within 30 days)
    const expiringRMBatches = await prisma.rawMaterialBatch.findMany({
      where: {
        is_active: true,
        expiry_date: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
      include: { raw_material: { select: { name: true, code: true } } },
      orderBy: { expiry_date: 'asc' },
      take: 10,
    });

    // BOM products count
    const productsWithBOM = await prisma.billOfMaterialItem.groupBy({
      by: ['product_id'],
    });

    // --- Charts Data ---

    // 1. Production trend (batches created per month over the period)
    const productionBatches = await prisma.batch.findMany({
      where: {
        created_at: { gte: startDate },
      },
      select: {
        created_at: true,
        quantity_produced: true,
        product: { select: { name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    const productionByMonth: Record<
      string,
      { month: string; batches_count: number; total_quantity: number }
    > = {};
    productionBatches.forEach((b) => {
      const monthKey = b.created_at.toISOString().slice(0, 7); // YYYY-MM
      const monthLabel = new Date(b.created_at).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
      if (!productionByMonth[monthKey]) {
        productionByMonth[monthKey] = {
          month: monthLabel,
          batches_count: 0,
          total_quantity: 0,
        };
      }
      productionByMonth[monthKey].batches_count += 1;
      productionByMonth[monthKey].total_quantity += Number(b.quantity_produced);
    });
    const productionTrend = Object.values(productionByMonth);

    // 2. Stock by product (top products by remaining stock)
    const stockByProduct = await prisma.batch.groupBy({
      by: ['product_id'],
      where: { is_active: true },
      _sum: { quantity_remaining: true, quantity_produced: true },
      _count: true,
      orderBy: { _sum: { quantity_remaining: 'desc' } },
      take: 10,
    });
    const productIds = stockByProduct.map((s) => s.product_id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p.name]));
    const stockByProductData = stockByProduct.map((s) => ({
      product: productMap.get(s.product_id) || 'Unknown',
      remaining: Number(s._sum.quantity_remaining || 0),
      produced: Number(s._sum.quantity_produced || 0),
      batches: s._count,
    }));

    // 3. Raw material stock levels (top materials by stock qty)
    const rmStockLevels = rawMaterials
      .map((rm) => ({
        name: rm.name,
        code: rm.code,
        stock: Number(rm.current_stock_quantity),
        min_level: Number(rm.min_stock_level_inventory || 0),
        value: Number(rm.current_stock_quantity) * Number(rm.weighted_average_cost),
        unit: rm.unit,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 4. Raw material by category
    const rmByCategory: Record<string, { category: string; count: number; value: number }> = {};
    rawMaterials.forEach((rm) => {
      const cat = rm.category || 'Uncategorized';
      if (!rmByCategory[cat]) {
        rmByCategory[cat] = { category: cat, count: 0, value: 0 };
      }
      rmByCategory[cat].count += 1;
      rmByCategory[cat].value +=
        Number(rm.current_stock_quantity) * Number(rm.weighted_average_cost);
    });
    const rmByCategoryData = Object.values(rmByCategory).sort((a, b) => b.value - a.value);

    // 5. Stock movements summary (last N days)
    const stockMovements = await prisma.stockMovement.findMany({
      where: { created_at: { gte: startDate } },
      select: {
        movement_type: true,
        quantity: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    const movementsByMonth: Record<
      string,
      { month: string; PURCHASE: number; SALE: number; ADJUSTMENT: number; PRODUCTION_CONSUMPTION: number; total: number }
    > = {};
    stockMovements.forEach((m) => {
      const monthKey = m.created_at.toISOString().slice(0, 7);
      const monthLabel = new Date(m.created_at).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
      if (!movementsByMonth[monthKey]) {
        movementsByMonth[monthKey] = {
          month: monthLabel,
          PURCHASE: 0,
          SALE: 0,
          ADJUSTMENT: 0,
          PRODUCTION_CONSUMPTION: 0,
          total: 0,
        };
      }
      const type = m.movement_type as string;
      if (type in movementsByMonth[monthKey]) {
        (movementsByMonth[monthKey] as any)[type] += Number(m.quantity);
      }
      movementsByMonth[monthKey].total += Number(m.quantity);
    });
    const movementsTrend = Object.values(movementsByMonth);

    // 6. Recent production batches
    const recentBatches = await prisma.batch.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
      include: {
        product: { select: { name: true } },
      },
    });

    res.json({
      summary: {
        total_products: totalProducts,
        total_raw_materials: totalRawMaterials,
        total_finished_batches: totalFinishedBatches,
        total_rm_batches: totalRMBatches,
        total_finished_stock: totalFinishedStock,
        total_produced_stock: totalProducedStock,
        total_rm_stock_value: totalRMStockValue,
        low_stock_rm_count: lowStockRawMaterials.length,
        expiring_finished_count: expiringFinishedBatches.length,
        expiring_rm_count: expiringRMBatches.length,
        products_with_bom: productsWithBOM.length,
      },
      charts: {
        production_trend: productionTrend,
        stock_by_product: stockByProductData,
        rm_stock_levels: rmStockLevels,
        rm_by_category: rmByCategoryData,
        movements_trend: movementsTrend,
      },
      alerts: {
        low_stock_raw_materials: lowStockRawMaterials.map((rm) => ({
          id: rm.id,
          name: rm.name,
          code: rm.code,
          current_stock: Number(rm.current_stock_quantity),
          min_level: Number(rm.min_stock_level_inventory),
          unit: rm.unit,
        })),
        expiring_finished_batches: expiringFinishedBatches.map((b) => ({
          id: b.id,
          batch_number: b.batch_number,
          product_name: b.product?.name || 'Unknown',
          expiry_date: b.expiry_date,
          quantity_remaining: Number(b.quantity_remaining),
        })),
        expiring_rm_batches: expiringRMBatches.map((b) => ({
          id: b.id,
          batch_number: b.batch_number,
          rm_name: b.raw_material?.name || 'Unknown',
          rm_code: b.raw_material?.code || '',
          expiry_date: b.expiry_date,
          quantity_remaining: Number(b.quantity_remaining),
        })),
      },
      recent_production: recentBatches.map((b) => ({
        id: b.id,
        batch_number: b.batch_number,
        product_name: b.product?.name || 'Unknown',
        manufacturing_date: b.manufacturing_date,
        quantity_produced: Number(b.quantity_produced),
        quantity_remaining: Number(b.quantity_remaining),
        unit: b.unit,
        created_at: b.created_at,
      })),
    });
  } catch (error) {
    logger.error('Get inventory production overview error:', error);
    res.status(500).json({ error: 'Failed to get inventory & production overview' });
  }
}

export async function getSalesCustomerOverview(req: AuthRequest, res: Response) {
  try {
    const { from_date, to_date } = req.query;

    // Default: last 90 days
    const endDate = to_date ? new Date(String(to_date)) : new Date();
    const startDate = from_date
      ? new Date(String(from_date))
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    // ─────────────── SUMMARY ───────────────

    // Total revenue from invoices in period
    const invoicesInPeriod = await prisma.invoice.findMany({
      where: {
        invoice_date: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        grand_total: true,
        amount_paid: true,
        amount_due: true,
        status: true,
        due_date: true,
        invoice_date: true,
        invoice_number: true,
        customer_id: true,
        customer: { select: { company_name: true, client_name: true } },
      },
    });

    const totalRevenue = invoicesInPeriod.reduce((s, inv) => s + Number(inv.grand_total), 0);

    // Total collected (payments) in period
    const paymentsInPeriod = await prisma.payment.findMany({
      where: {
        payment_date: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        payment_number: true,
        amount: true,
        payment_method: true,
        payment_date: true,
        customer_id: true,
        customer: { select: { company_name: true, client_name: true } },
      },
      orderBy: { payment_date: 'desc' },
    });

    const totalCollected = paymentsInPeriod.reduce((s, p) => s + Number(p.amount), 0);
    const totalOutstanding = totalRevenue - totalCollected;
    const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0;

    // Total sales orders in period
    const totalSalesOrders = await prisma.salesOrder.count({
      where: {
        order_date: { gte: startDate, lte: endDate },
      },
    });

    // Active customers (unique customers with orders in period)
    const activeCustomerIds = await prisma.salesOrder.groupBy({
      by: ['customer_id'],
      where: {
        order_date: { gte: startDate, lte: endDate },
      },
    });
    const activeCustomers = activeCustomerIds.length;

    // Average order value
    const avgOrderValue = totalSalesOrders > 0 ? totalRevenue / totalSalesOrders : 0;

    // Overdue invoices (due_date < now, not fully paid, not cancelled)
    const now = new Date();
    const overdueInvoices = invoicesInPeriod.filter(
      (inv) => inv.due_date < now && inv.status !== 'PAID' && inv.status !== 'CANCELLED'
    );

    // ─────────────── CHARTS ───────────────

    // 1. Revenue vs Collections (monthly time series)
    const revenueByMonth: Record<string, { month: string; monthKey: string; revenue: number; collections: number }> = {};

    invoicesInPeriod.forEach((inv) => {
      const mk = inv.invoice_date.toISOString().slice(0, 7);
      const ml = new Date(inv.invoice_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!revenueByMonth[mk]) revenueByMonth[mk] = { month: ml, monthKey: mk, revenue: 0, collections: 0 };
      revenueByMonth[mk].revenue += Number(inv.grand_total);
    });

    paymentsInPeriod.forEach((p) => {
      const mk = p.payment_date.toISOString().slice(0, 7);
      const ml = new Date(p.payment_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!revenueByMonth[mk]) revenueByMonth[mk] = { month: ml, monthKey: mk, revenue: 0, collections: 0 };
      revenueByMonth[mk].collections += Number(p.amount);
    });

    const revenueVsCollections = Object.values(revenueByMonth)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map(({ month, revenue, collections }) => {
        return { month, revenue: Math.round(revenue * 100) / 100, collections: Math.round(collections * 100) / 100 };
      });

    // Add cumulative totals
    let cumRevenue = 0;
    let cumCollections = 0;
    const revenueVsCollectionsWithCumulative = revenueVsCollections.map((d) => {
      cumRevenue += d.revenue;
      cumCollections += d.collections;
      return { ...d, cumulative_revenue: Math.round(cumRevenue * 100) / 100, cumulative_collections: Math.round(cumCollections * 100) / 100 };
    });

    // 2. Cash Flow (cash in from customers vs cash out from purchases)
    const cashFlowByMonth: Record<string, { month: string; monthKey: string; cash_in: number; cash_out: number }> = {};

    paymentsInPeriod.forEach((p) => {
      const mk = p.payment_date.toISOString().slice(0, 7);
      const ml = new Date(p.payment_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!cashFlowByMonth[mk]) cashFlowByMonth[mk] = { month: ml, monthKey: mk, cash_in: 0, cash_out: 0 };
      cashFlowByMonth[mk].cash_in += Number(p.amount);
    });

    // Cash out: PO items total_price for POs in period (received/completed)
    const purchaseOrdersInPeriod = await prisma.purchaseOrder.findMany({
      where: {
        order_date: { gte: startDate, lte: endDate },
        status: 'RECEIVED',
      },
      select: {
        order_date: true,
        items: { select: { total_price: true } },
      },
    });

    purchaseOrdersInPeriod.forEach((po) => {
      const mk = po.order_date.toISOString().slice(0, 7);
      const ml = new Date(po.order_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!cashFlowByMonth[mk]) cashFlowByMonth[mk] = { month: ml, monthKey: mk, cash_in: 0, cash_out: 0 };
      const poTotal = po.items.reduce((s, item) => s + Number(item.total_price), 0);
      cashFlowByMonth[mk].cash_out += poTotal;
    });

    const cashFlow = Object.values(cashFlowByMonth)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map(({ month, cash_in, cash_out }) => ({
        month,
        cash_in: Math.round(cash_in * 100) / 100,
        cash_out: Math.round(cash_out * 100) / 100,
        net: Math.round((cash_in - cash_out) * 100) / 100,
      }));

    // 3. Sales Order Trend (monthly)
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        order_date: { gte: startDate, lte: endDate },
      },
      select: {
        order_date: true,
        invoices: { select: { grand_total: true } },
      },
      orderBy: { order_date: 'asc' },
    });

    const soByMonth: Record<string, { month: string; monthKey: string; order_count: number; order_value: number }> = {};
    salesOrders.forEach((so) => {
      const mk = so.order_date.toISOString().slice(0, 7);
      const ml = new Date(so.order_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!soByMonth[mk]) soByMonth[mk] = { month: ml, monthKey: mk, order_count: 0, order_value: 0 };
      soByMonth[mk].order_count += 1;
      soByMonth[mk].order_value += so.invoices.reduce((s, inv) => s + Number(inv.grand_total), 0);
    });
    const salesOrderTrend = Object.values(soByMonth)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map(({ month, order_count, order_value }) => ({
        month,
        order_count,
        order_value: Math.round(order_value * 100) / 100,
      }));

    // 4. Invoice Status Distribution
    const invoiceStatusMap: Record<string, { status: string; count: number; total_value: number }> = {};
    invoicesInPeriod.forEach((inv) => {
      if (!invoiceStatusMap[inv.status]) invoiceStatusMap[inv.status] = { status: inv.status, count: 0, total_value: 0 };
      invoiceStatusMap[inv.status].count += 1;
      invoiceStatusMap[inv.status].total_value += Number(inv.grand_total);
    });
    const invoiceStatusDistribution = Object.values(invoiceStatusMap);

    // 5. Payment Method Distribution
    const payMethodMap: Record<string, { method: string; count: number; total_amount: number }> = {};
    paymentsInPeriod.forEach((p) => {
      const m = p.payment_method;
      if (!payMethodMap[m]) payMethodMap[m] = { method: m, count: 0, total_amount: 0 };
      payMethodMap[m].count += 1;
      payMethodMap[m].total_amount += Number(p.amount);
    });
    const paymentMethodDistribution = Object.values(payMethodMap).sort((a, b) => b.total_amount - a.total_amount);

    // 6. New Customer Trend (monthly customer registration)
    const newCustomers = await prisma.customer.findMany({
      where: {
        created_at: { gte: startDate, lte: endDate },
      },
      select: { created_at: true },
      orderBy: { created_at: 'asc' },
    });
    const newCustByMonth: Record<string, { month: string; monthKey: string; new_customers: number }> = {};
    newCustomers.forEach((c) => {
      const mk = c.created_at.toISOString().slice(0, 7);
      const ml = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!newCustByMonth[mk]) newCustByMonth[mk] = { month: ml, monthKey: mk, new_customers: 0 };
      newCustByMonth[mk].new_customers += 1;
    });
    const customerTrend = Object.values(newCustByMonth)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map(({ month, new_customers }) => ({ month, new_customers }));

    // ─────────────── TABLES ───────────────

    // Top 10 customers by revenue
    const customerRevenueMap: Record<string, {
      customer_id: string;
      customer_name: string;
      total_revenue: number;
      total_paid: number;
      order_count: number;
    }> = {};

    invoicesInPeriod.forEach((inv) => {
      const cid = inv.customer_id;
      const cname = inv.customer?.company_name || inv.customer?.client_name || 'Unknown';
      if (!customerRevenueMap[cid]) {
        customerRevenueMap[cid] = { customer_id: cid, customer_name: cname, total_revenue: 0, total_paid: 0, order_count: 0 };
      }
      customerRevenueMap[cid].total_revenue += Number(inv.grand_total);
      customerRevenueMap[cid].total_paid += Number(inv.amount_paid);
      customerRevenueMap[cid].order_count += 1;
    });

    const topCustomers = Object.values(customerRevenueMap)
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10)
      .map((c) => ({
        ...c,
        total_revenue: Math.round(c.total_revenue * 100) / 100,
        total_paid: Math.round(c.total_paid * 100) / 100,
        total_outstanding: Math.round((c.total_revenue - c.total_paid) * 100) / 100,
      }));

    // Overdue invoices with aging
    const overdueInvoicesList = overdueInvoices
      .map((inv) => {
        const daysOverdue = Math.floor((now.getTime() - inv.due_date.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          customer_name: inv.customer?.company_name || inv.customer?.client_name || 'Unknown',
          grand_total: Number(inv.grand_total),
          amount_due: Number(inv.amount_due),
          due_date: inv.due_date,
          days_overdue: daysOverdue,
        };
      })
      .sort((a, b) => b.days_overdue - a.days_overdue);

    // Recent payments (last 10)
    const recentPayments = paymentsInPeriod.slice(0, 10).map((p) => ({
      id: p.id,
      payment_number: p.payment_number,
      customer_name: p.customer?.company_name || p.customer?.client_name || 'Unknown',
      amount: Number(p.amount),
      payment_method: p.payment_method,
      payment_date: p.payment_date,
    }));

    // ─────────────── TOP 5 PERFORMERS (chart) ───────────────

    // Build per-customer revenue + payment aggregation for the period
    const customerPerfMap: Record<string, {
      customer_id: string;
      customer_name: string;
      total_revenue: number;
      total_collected: number;
      order_count: number;
      invoice_count: number;
    }> = {};

    invoicesInPeriod.forEach((inv) => {
      const cid = inv.customer_id;
      const cname = inv.customer?.company_name || inv.customer?.client_name || 'Unknown';
      if (!customerPerfMap[cid]) {
        customerPerfMap[cid] = {
          customer_id: cid,
          customer_name: cname,
          total_revenue: 0,
          total_collected: 0,
          order_count: 0,
          invoice_count: 0,
        };
      }
      customerPerfMap[cid].total_revenue += Number(inv.grand_total);
      customerPerfMap[cid].total_collected += Number(inv.amount_paid);
      customerPerfMap[cid].invoice_count += 1;
    });

    // Count distinct sales orders per customer in period
    const soByCustomer = await prisma.salesOrder.groupBy({
      by: ['customer_id'],
      where: { order_date: { gte: startDate, lte: endDate } },
      _count: true,
    });
    soByCustomer.forEach((so) => {
      if (customerPerfMap[so.customer_id]) {
        customerPerfMap[so.customer_id].order_count = so._count;
      }
    });

    const topPerformers = Object.values(customerPerfMap)
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 5)
      .map((c) => ({
        customer_id: c.customer_id,
        customer_name: c.customer_name,
        total_revenue: Math.round(c.total_revenue * 100) / 100,
        total_collected: Math.round(c.total_collected * 100) / 100,
        collection_rate: c.total_revenue > 0
          ? Math.round((c.total_collected / c.total_revenue) * 1000) / 10
          : 0,
        order_count: c.order_count,
        invoice_count: c.invoice_count,
      }));

    // ─────────────── HIGH RISK CUSTOMERS (alerts) ───────────────
    // Risk criteria:
    // - Outstanding > 50% of their total revenue
    // - Has overdue invoices
    // - Average days overdue > 30
    // - Collection rate < 50%

    // Build overdue data per customer
    const customerOverdueMap: Record<string, {
      overdue_count: number;
      overdue_amount: number;
      max_days_overdue: number;
      total_days_overdue: number;
    }> = {};

    overdueInvoicesList.forEach((inv) => {
      // We need the customer_id, get it from invoicesInPeriod
      const fullInv = invoicesInPeriod.find((i) => i.id === inv.id);
      if (!fullInv) return;
      const cid = fullInv.customer_id;
      if (!customerOverdueMap[cid]) {
        customerOverdueMap[cid] = { overdue_count: 0, overdue_amount: 0, max_days_overdue: 0, total_days_overdue: 0 };
      }
      customerOverdueMap[cid].overdue_count += 1;
      customerOverdueMap[cid].overdue_amount += inv.amount_due;
      customerOverdueMap[cid].max_days_overdue = Math.max(customerOverdueMap[cid].max_days_overdue, inv.days_overdue);
      customerOverdueMap[cid].total_days_overdue += inv.days_overdue;
    });

    // Score each customer for risk
    const highRiskCustomers = Object.entries(customerPerfMap)
      .map(([cid, perf]) => {
        const overdue = customerOverdueMap[cid] || { overdue_count: 0, overdue_amount: 0, max_days_overdue: 0, total_days_overdue: 0 };
        const outstanding = perf.total_revenue - perf.total_collected;
        const collRate = perf.total_revenue > 0 ? (perf.total_collected / perf.total_revenue) * 100 : 100;
        const avgDaysOverdue = overdue.overdue_count > 0 ? overdue.total_days_overdue / overdue.overdue_count : 0;

        // Risk score (0-100)
        let riskScore = 0;
        // High outstanding ratio
        if (perf.total_revenue > 0) {
          const outstandingRatio = outstanding / perf.total_revenue;
          if (outstandingRatio > 0.8) riskScore += 35;
          else if (outstandingRatio > 0.5) riskScore += 25;
          else if (outstandingRatio > 0.3) riskScore += 10;
        }
        // Overdue invoices
        if (overdue.overdue_count >= 3) riskScore += 25;
        else if (overdue.overdue_count >= 2) riskScore += 15;
        else if (overdue.overdue_count >= 1) riskScore += 10;
        // Max days overdue
        if (overdue.max_days_overdue > 90) riskScore += 25;
        else if (overdue.max_days_overdue > 60) riskScore += 15;
        else if (overdue.max_days_overdue > 30) riskScore += 10;
        // Poor collection rate
        if (collRate < 30) riskScore += 15;
        else if (collRate < 50) riskScore += 10;
        else if (collRate < 70) riskScore += 5;

        // Build risk reasons
        const reasons: string[] = [];
        if (overdue.overdue_count > 0) reasons.push(`${overdue.overdue_count} overdue invoice${overdue.overdue_count > 1 ? 's' : ''}`);
        if (overdue.max_days_overdue > 60) reasons.push(`${overdue.max_days_overdue} days overdue`);
        if (collRate < 50 && perf.total_revenue > 0) reasons.push(`${Math.round(collRate)}% collection rate`);
        if (outstanding > 0 && perf.total_revenue > 0 && outstanding / perf.total_revenue > 0.5) reasons.push('High outstanding ratio');

        return {
          customer_id: cid,
          customer_name: perf.customer_name,
          total_revenue: Math.round(perf.total_revenue * 100) / 100,
          total_collected: Math.round(perf.total_collected * 100) / 100,
          outstanding: Math.round(outstanding * 100) / 100,
          collection_rate: Math.round(collRate * 10) / 10,
          overdue_count: overdue.overdue_count,
          overdue_amount: Math.round(overdue.overdue_amount * 100) / 100,
          max_days_overdue: overdue.max_days_overdue,
          risk_score: riskScore,
          risk_level: riskScore >= 50 ? 'critical' as const : riskScore >= 30 ? 'high' as const : riskScore >= 15 ? 'medium' as const : 'low' as const,
          reasons,
        };
      })
      .filter((c) => c.risk_score >= 15) // Only show medium risk and above
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 10);

    res.json({
      summary: {
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_collected: Math.round(totalCollected * 100) / 100,
        total_outstanding: Math.round(totalOutstanding * 100) / 100,
        collection_rate: Math.round(collectionRate * 10) / 10,
        total_sales_orders: totalSalesOrders,
        active_customers: activeCustomers,
        avg_order_value: Math.round(avgOrderValue * 100) / 100,
        overdue_invoices: overdueInvoices.length,
        high_risk_count: highRiskCustomers.filter((c) => c.risk_level === 'critical' || c.risk_level === 'high').length,
      },
      charts: {
        revenue_vs_collections: revenueVsCollectionsWithCumulative,
        cash_flow: cashFlow,
        sales_order_trend: salesOrderTrend,
        invoice_status_distribution: invoiceStatusDistribution,
        payment_method_distribution: paymentMethodDistribution,
        customer_trend: customerTrend,
        top_performers: topPerformers,
      },
      tables: {
        top_customers: topCustomers,
        overdue_invoices: overdueInvoicesList,
        recent_payments: recentPayments,
        high_risk_customers: highRiskCustomers,
      },
    });
  } catch (error) {
    logger.error('Get sales customer overview error:', error);
    res.status(500).json({ error: 'Failed to get sales & customer overview' });
  }
}

export async function getRevenueTimeSeries(req: AuthRequest, res: Response) {
  try {
    const { period = '30', interval = 'day' } = req.query;
    const daysAgo = parseInt(String(period));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const invoices = await prisma.invoice.findMany({
      where: {
        invoice_date: {
          gte: startDate,
        },
      },
      select: {
        invoice_date: true,
        grand_total: true,
        status: true,
      },
      orderBy: {
        invoice_date: 'asc',
      },
    });

    // Group by date
    const revenueByDate: Record<string, { total: number; paid: number; count: number }> = {};

    invoices.forEach((inv) => {
      const dateKey = inv.invoice_date.toISOString().split('T')[0];
      if (!revenueByDate[dateKey]) {
        revenueByDate[dateKey] = { total: 0, paid: 0, count: 0 };
      }
      revenueByDate[dateKey].total += Number(inv.grand_total);
      if (inv.status === 'PAID') {
        revenueByDate[dateKey].paid += Number(inv.grand_total);
      }
      revenueByDate[dateKey].count += 1;
    });

    const timeSeries = Object.entries(revenueByDate).map(([date, data]) => ({
      date,
      total_revenue: data.total,
      paid_revenue: data.paid,
      invoice_count: data.count,
    }));

    res.json({
      time_series: timeSeries,
    });
  } catch (error) {
    logger.error('Get revenue time series error:', error);
    res.status(500).json({ error: 'Failed to get revenue time series' });
  }
}
