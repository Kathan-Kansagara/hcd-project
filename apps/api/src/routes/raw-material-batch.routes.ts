import { Router } from 'express';
import * as batchController from '../controllers/raw-material-batch.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All raw material batch routes require authentication
router.use(authMiddleware);

// Raw material batch routes with permission-based access control
router.post('/', requirePermission('raw-material-batches:manage'), batchController.createRawMaterialBatch);
router.get('/', requirePermission('raw-material-batches:view'), batchController.getRawMaterialBatches);
router.get('/raw-material/:raw_material_id/available', requirePermission('raw-material-batches:view'), batchController.getAvailableBatches);
router.get('/:id', requirePermission('raw-material-batches:view'), batchController.getRawMaterialBatchById);
router.put('/:id', requirePermission('raw-material-batches:manage'), batchController.updateRawMaterialBatch);
router.put('/:id/adjust-stock', requirePermission('raw-material-batches:manage'), batchController.adjustStock);
router.delete('/:id', requirePermission('raw-material-batches:manage'), batchController.deleteRawMaterialBatch);

export default router;
