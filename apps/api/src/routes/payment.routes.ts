import { Router } from 'express';
import {
  recordPayment,
  getPayments,
  getPaymentById,
  deletePayment,
} from '../controllers/payment.controller.js';
import {
  createRazorpayOrder,
  verifyRazorpayPayment
} from '../controllers/online-payment.controller.js';
import { getUpiQrData } from '../controllers/upi-qr.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Payment routes with permission-based access control
router.get('/', requirePermission('payments:view'), getPayments);
router.get('/:id', requirePermission('payments:view'), getPaymentById);
router.post('/', requirePermission('payments:manage'), recordPayment);
router.delete('/:id', requirePermission('payments:manage'), deletePayment);

// UPI QR code data
router.get('/upi-qr-data', requirePermission('payments:view'), getUpiQrData);

// Online payment routes via Razorpay
router.post('/razorpay/create-order', requirePermission('payments:manage'), createRazorpayOrder);
router.post('/razorpay/verify', requirePermission('payments:manage'), verifyRazorpayPayment);

export default router;
