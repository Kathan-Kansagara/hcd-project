import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All product routes require authentication
router.use(authMiddleware);

// Product routes with permission-based access control
router.post('/', requirePermission('products:manage'), productController.createProduct);
router.get('/', requirePermission('products:view'), productController.getProducts);
router.get('/categories/list', requirePermission('products:view'), productController.getProductCategories);
router.get('/:id', requirePermission('products:view'), productController.getProductById);
router.put('/:id', requirePermission('products:manage'), productController.updateProduct);
router.delete('/:id', requirePermission('products:manage'), productController.deleteProduct);

export default router;
