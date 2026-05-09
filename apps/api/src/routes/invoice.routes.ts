import { Router } from 'express';
import {
  createInvoiceFromDeliveryNote,
  getInvoices,
  getInvoiceById,
  getInvoiceByNumber,
  updateInvoice,
  downloadInvoicePDF,
} from '../controllers/invoice.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Invoice routes with permission-based access control
router.get('/', requirePermission('invoices:view'), getInvoices);
router.get('/lookup/:invoiceNumber', requirePermission('invoices:view'), getInvoiceByNumber);
router.get('/:id/pdf', requirePermission('invoices:view'), downloadInvoicePDF);
router.get('/:id', requirePermission('invoices:view'), getInvoiceById);
router.post('/', requirePermission('invoices:manage'), createInvoiceFromDeliveryNote);
router.put('/:id', requirePermission('invoices:manage'), updateInvoice);

export default router;
