import { Router } from 'express';
import * as applicationController from '../controllers/application.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All application routes require authentication
router.use(authMiddleware);

// Application routes with permission-based access control
router.post('/', requirePermission('applications:manage'), applicationController.createApplication);

// Get all applications - requires applications:view permission
router.get('/', requirePermission('applications:view'), applicationController.getApplications);

// Get application by ID - requires applications:view permission
router.get('/:id', requirePermission('applications:view'), applicationController.getApplicationById);

// Update application - requires applications:manage permission
router.put('/:id', requirePermission('applications:manage'), applicationController.updateApplication);

// Delete application - requires applications:manage permission
router.delete('/:id', requirePermission('applications:manage'), applicationController.deleteApplication);

export default router;
