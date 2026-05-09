import { Router } from 'express';
import * as purchaseOrderController from '../controllers/purchase-order.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All purchase order routes require authentication
router.use(authMiddleware);

// Purchase order routes with permission-based access control
router.post('/', requirePermission('purchase-orders:manage'), purchaseOrderController.createPurchaseOrder);
router.get('/', requirePermission('purchase-orders:view'), purchaseOrderController.getPurchaseOrders);
router.get('/:id', requirePermission('purchase-orders:view'), purchaseOrderController.getPurchaseOrderById);
router.put('/:id', requirePermission('purchase-orders:manage'), purchaseOrderController.updatePurchaseOrder);
router.post('/:id/mark-received', requirePermission('purchase-orders:manage'), purchaseOrderController.markReceived);
router.delete('/:id/cancel', requirePermission('purchase-orders:manage'), purchaseOrderController.cancelPurchaseOrder);

export default router;
