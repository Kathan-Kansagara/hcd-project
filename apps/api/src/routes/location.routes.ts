import { Router } from 'express';
import * as locationController from '../controllers/location.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All location routes require authentication
router.use(authMiddleware);

// Lookup endpoints - available to all authenticated users (read-only)
router.get('/states', locationController.getStates);
router.get('/districts', locationController.getDistricts);
router.get('/pincode/:pincode', locationController.getByPincode);

// Location CRUD endpoints with permission checks
router.get('/', locationController.getLocations);
router.get('/:id', locationController.getLocationById);
router.post('/', requirePermission('farmers:create'), locationController.createLocation);
router.put('/:id', requirePermission('farmers:update'), locationController.updateLocation);
router.delete('/:id', requirePermission('farmers:delete'), locationController.deleteLocation);

export default router;
