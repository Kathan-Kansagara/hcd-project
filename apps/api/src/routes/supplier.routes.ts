import { Router } from 'express';
import * as supplierController from '../controllers/supplier.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All supplier routes require authentication
router.use(authMiddleware);

// Supplier routes with permission-based access control
router.post('/', requirePermission('suppliers:manage'), supplierController.createSupplier);

// Get all suppliers - requires suppliers:view permission
router.get('/', requirePermission('suppliers:view'), supplierController.getSuppliers);

// Get supplier by ID - requires suppliers:view permission
router.get('/:id', requirePermission('suppliers:view'), supplierController.getSupplierById);

// Update supplier - requires suppliers:manage permission
router.put('/:id', requirePermission('suppliers:manage'), supplierController.updateSupplier);

// Delete (soft delete) supplier - requires suppliers:manage permission
router.delete('/:id', requirePermission('suppliers:manage'), supplierController.deleteSupplier);

export default router;
