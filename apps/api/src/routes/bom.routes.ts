import { Router } from 'express';
import * as bomController from '../controllers/bom.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All BOM routes require authentication
router.use(authMiddleware);

// BOM routes with permission-based access control
router.get('/', requirePermission('bom:view'), bomController.getAllBOMItems);
router.get('/products', requirePermission('bom:view'), bomController.getProductsWithBOM);
router.post('/', requirePermission('bom:manage'), bomController.createBOMItem);
router.post('/bulk', requirePermission('bom:manage'), bomController.bulkCreateBOMItems);
router.get('/product/:product_id', requirePermission('bom:view'), bomController.getBOMByProduct);
router.get('/product/:product_id/calculate', requirePermission('bom:view'), bomController.calculateMaterialRequirements);
router.get('/product/:product_id/check-availability', requirePermission('bom:view'), bomController.checkMaterialAvailability);
router.delete('/product/:product_id', requirePermission('bom:manage'), bomController.deleteProductBOM);
router.get('/:id', requirePermission('bom:view'), bomController.getBOMItemById);
router.put('/:id', requirePermission('bom:manage'), bomController.updateBOMItem);
router.delete('/:id', requirePermission('bom:manage'), bomController.deleteBOMItem);

export default router;
