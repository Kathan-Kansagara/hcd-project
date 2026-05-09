import { Router } from 'express';
import * as profileController from '../controllers/profile.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// All profile routes require authentication
router.use(authMiddleware);

// Get current user profile
router.get('/', profileController.getProfile);

// Update current user profile
router.put('/', profileController.updateProfile);

// Update current user password
router.put('/password', profileController.updatePassword);

export default router;
