import { Router } from 'express';
import * as productionController from '../controllers/production.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All production routes require authentication
router.use(authMiddleware);

// Production routes with permission-based access control
router.post('/batch-with-consumption', requirePermission('production:manage'), productionController.createBatchWithConsumption);
router.get('/batch/:id/traceability', requirePermission('production:view'), productionController.getBatchTraceability);
router.get('/raw-material-batch/:id/traceability', requirePermission('production:view'), productionController.getRawMaterialTraceability);

export default router;
