import { Router } from 'express';
import * as photoController from '../controllers/photo.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';
import { uploadSingle } from '../middleware/upload.middleware.js';

const router = Router();

// All photo routes require authentication
router.use(authMiddleware);

// Photo routes with permission-based access control
router.post(
  '/applications/:applicationId/photos',
  requirePermission('photos:manage'),
  uploadSingle,
  photoController.uploadPhoto
);

// Get photos for application - requires photos:view permission
router.get('/applications/:applicationId/photos', requirePermission('photos:view'), photoController.getPhotosByApplication);

// Delete photo - requires photos:manage permission
router.delete('/photos/:id', requirePermission('photos:manage'), photoController.deletePhoto);

export default router;
