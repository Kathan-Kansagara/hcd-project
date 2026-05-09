import { Router } from 'express';
import * as rawMaterialController from '../controllers/raw-material.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All raw material routes require authentication
router.use(authMiddleware);

// Raw material routes with permission-based access control
router.post('/', requirePermission('raw-materials:manage'), rawMaterialController.createRawMaterial);
router.get('/', requirePermission('raw-materials:view'), rawMaterialController.getRawMaterials);
router.get('/next-code', requirePermission('raw-materials:view'), rawMaterialController.getNextCode);
router.get('/categories/list', requirePermission('raw-materials:view'), rawMaterialController.getRawMaterialCategories);
router.get('/suppliers/list', requirePermission('raw-materials:view'), rawMaterialController.getSuppliers);
router.get('/:id', requirePermission('raw-materials:view'), rawMaterialController.getRawMaterialById);
router.get('/:id/stock-summary', requirePermission('raw-materials:view'), rawMaterialController.getStockSummary);
router.put('/:id', requirePermission('raw-materials:manage'), rawMaterialController.updateRawMaterial);
router.delete('/:id', requirePermission('raw-materials:manage'), rawMaterialController.deleteRawMaterial);

export default router;
