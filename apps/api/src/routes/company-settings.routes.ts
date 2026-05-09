import { Router } from 'express';
import * as companySettingsController from '../controllers/company-settings.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All company settings routes require authentication
router.use(authMiddleware);

// Company settings routes with permission-based access control
router.get('/', requirePermission('company-settings:view'), companySettingsController.getSettings);

// Update company settings - requires company-settings:manage permission
router.put('/', requirePermission('company-settings:manage'), companySettingsController.updateSettings);

export default router;
