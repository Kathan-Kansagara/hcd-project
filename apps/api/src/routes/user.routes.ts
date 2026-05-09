import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

// User routes with permission-based access control
router.get('/', requirePermission('users:view'), userController.getUsers);

// Get user by ID - requires users:view permission
router.get('/:id', requirePermission('users:view'), userController.getUserById);

// Create user - requires users:manage permission
router.post('/', requirePermission('users:manage'), userController.createUser);

// Update user - requires users:manage permission
router.put('/:id', requirePermission('users:manage'), userController.updateUser);

// Delete user - requires users:manage permission
router.delete('/:id', requirePermission('users:manage'), userController.deleteUser);

export default router;
