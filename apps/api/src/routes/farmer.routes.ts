import { Router } from 'express';
import * as farmerController from '../controllers/farmer.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All farmer routes require authentication
router.use(authMiddleware);

// Farmer routes with permission-based access control
router.post('/', requirePermission('farmers:manage'), farmerController.createFarmer);

// Get all farmers - requires farmers:view permission
router.get('/', requirePermission('farmers:view'), farmerController.getFarmers);

// Get location details by village - requires farmers:view permission
router.get('/locations/details', requirePermission('farmers:view'), farmerController.getLocationDetails);

// Get distinct locations by type - requires farmers:view permission
router.get('/locations/:type', requirePermission('farmers:view'), farmerController.getFarmerLocations);

// Get farmer by ID - requires farmers:view permission
router.get('/:id', requirePermission('farmers:view'), farmerController.getFarmerById);

// Update farmer - requires farmers:manage permission
router.put('/:id', requirePermission('farmers:manage'), farmerController.updateFarmer);

// Archive farmer - requires farmers:manage permission
router.post('/:id/archive', requirePermission('farmers:manage'), farmerController.archiveFarmer);

// Unarchive farmer - requires farmers:manage permission
router.post('/:id/unarchive', requirePermission('farmers:manage'), farmerController.unarchiveFarmer);

export default router;
