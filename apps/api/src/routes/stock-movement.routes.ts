import { Router } from 'express';
import { getStockMovements, getStockMovementById } from '../controllers/stock-movement.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Stock movement routes
router.get('/', requirePermission('raw-material-batches:view'), getStockMovements);
router.get('/:id', requirePermission('raw-material-batches:view'), getStockMovementById);

export default router;
