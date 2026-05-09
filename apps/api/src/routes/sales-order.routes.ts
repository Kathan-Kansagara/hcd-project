import { Router } from 'express';
import {
  createSalesOrder,
  getSalesOrders,
  getSalesOrderById,
  updateSalesOrder,
  cancelSalesOrder,
  markDelivered,
} from '../controllers/sales-order.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Sales Order routes with permission-based access control
router.get('/', requirePermission('sales-orders:view'), getSalesOrders);
router.get('/:id', requirePermission('sales-orders:view'), getSalesOrderById);
router.post('/', requirePermission('sales-orders:manage'), createSalesOrder);
router.put('/:id', requirePermission('sales-orders:manage'), updateSalesOrder);
router.put('/:id/mark-delivered', requirePermission('sales-orders:manage'), markDelivered);
router.delete('/:id/cancel', requirePermission('sales-orders:manage'), cancelSalesOrder);

export default router;
