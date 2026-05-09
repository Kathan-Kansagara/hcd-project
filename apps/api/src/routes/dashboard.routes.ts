import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All dashboard routes require authentication
router.use(authMiddleware);

// Get dashboard statistics (trials) - requires dashboard:view permission
router.get('/', requirePermission('dashboard:view'), dashboardController.getDashboardStats);
router.get('/stats', requirePermission('dashboard:view'), dashboardController.getDashboardStats);

// Analytics endpoints - require dashboard:view permission
router.get('/analytics/inventory', requirePermission('dashboard:view'), dashboardController.getInventoryAnalytics);
router.get('/analytics/sales', requirePermission('dashboard:view'), dashboardController.getSalesAnalytics);
router.get('/analytics/purchases', requirePermission('dashboard:view'), dashboardController.getPurchaseAnalytics);
router.get('/analytics/revenue-time-series', requirePermission('dashboard:view'), dashboardController.getRevenueTimeSeries);
router.get('/analytics/inventory-production-overview', requirePermission('dashboard:view'), dashboardController.getInventoryProductionOverview);
router.get('/analytics/sales-customer-overview', requirePermission('dashboard:view'), dashboardController.getSalesCustomerOverview);

export default router;
