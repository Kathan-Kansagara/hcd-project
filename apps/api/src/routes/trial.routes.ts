import { Router } from 'express';
import * as trialController from '../controllers/trial.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All trial routes require authentication
router.use(authMiddleware);

// Trial routes with permission-based access control
router.post('/', requirePermission('trials:manage'), trialController.createTrial);

// Get all trials - requires trials:view permission
router.get('/', requirePermission('trials:view'), trialController.getTrials);

// Get filter options - requires trials:view permission
router.get('/filter-options', requirePermission('trials:view'), trialController.getTrialFilterOptions);

// Get trial by ID - requires trials:view permission
router.get('/:id', requirePermission('trials:view'), trialController.getTrialById);

// Update trial - requires trials:manage permission
router.put('/:id', requirePermission('trials:manage'), trialController.updateTrial);

// Delete trial - requires trials:manage permission
router.delete('/:id', requirePermission('trials:manage'), trialController.deleteTrial);

export default router;
