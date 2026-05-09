import { Router } from 'express';
import {
  createDeliveryNoteFromSalesOrder,
  getDeliveryNotes,
  getDeliveryNoteById,
} from '../controllers/delivery-note.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Delivery Note routes with permission-based access control
router.get('/', requirePermission('delivery-notes:view'), getDeliveryNotes);
router.get('/:id', requirePermission('delivery-notes:view'), getDeliveryNoteById);
router.post('/', requirePermission('delivery-notes:manage'), createDeliveryNoteFromSalesOrder);

export default router;
