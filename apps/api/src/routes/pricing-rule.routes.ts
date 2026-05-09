import { Router } from 'express';
import {
  createPricingRule,
  getPricingRules,
  getPricingRuleById,
  updatePricingRule,
  deletePricingRule,
  getApplicablePrice,
} from '../controllers/pricing-rule.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Pricing rule routes with permission-based access control
router.get('/', requirePermission('pricing-rules:view'), getPricingRules);
router.get('/calculate-price', requirePermission('pricing-rules:view'), getApplicablePrice);
router.get('/:id', requirePermission('pricing-rules:view'), getPricingRuleById);
router.post('/', requirePermission('pricing-rules:manage'), createPricingRule);
router.put('/:id', requirePermission('pricing-rules:manage'), updatePricingRule);
router.delete('/:id', requirePermission('pricing-rules:manage'), deletePricingRule);

export default router;
