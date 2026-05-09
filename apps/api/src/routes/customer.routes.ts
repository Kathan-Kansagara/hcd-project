import { Router } from 'express';
import * as customerController from '../controllers/customer.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All customer routes require authentication
router.use(authMiddleware);

// Customer routes with permission-based access control
router.post('/', requirePermission('customers:manage'), customerController.createCustomer);

// Get all customers - requires customers:view permission
router.get('/', requirePermission('customers:view'), customerController.getCustomers);

// Get customer by ID - requires customers:view permission
router.get('/:id', requirePermission('customers:view'), customerController.getCustomerById);

// Update customer - requires customers:manage permission
router.put('/:id', requirePermission('customers:manage'), customerController.updateCustomer);

// Delete (soft delete) customer - requires customers:manage permission
router.delete('/:id', requirePermission('customers:manage'), customerController.deleteCustomer);

export default router;
