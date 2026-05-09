import { Router } from 'express';
import * as batchController from '../controllers/batch.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All batch routes require authentication
router.use(authMiddleware);

// Create batch - requires batches:create or batches:manage permission
router.post('/', requirePermission('batches:manage'), batchController.createBatch);

// Get all batches - requires batches:view permission
router.get('/', requirePermission('batches:view'), batchController.getBatches);

// Get batches by product - requires batches:view permission
router.get('/product/:product_id', requirePermission('batches:view'), batchController.getBatchesByProduct);

// Get batch by ID - requires batches:view permission
router.get('/:id', requirePermission('batches:view'), batchController.getBatchById);

// Update batch - requires batches:update or batches:manage permission
router.put('/:id', requirePermission('batches:manage'), batchController.updateBatch);

// Delete batch - requires batches:delete or batches:manage permission
router.delete('/:id', requirePermission('batches:manage'), batchController.deleteBatch);

export default router;
