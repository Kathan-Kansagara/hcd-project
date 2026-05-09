import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

/**
 * Returns the UPI payment URI and metadata for a given invoice.
 * The frontend uses this to generate a QR code in-browser.
 *
 * UPI URI format: upi://pay?pa=<VPA>&pn=<PayeeName>&am=<Amount>&cu=INR&tn=<Note>
 */
export async function getUpiQrData(req: AuthRequest, res: Response) {
  try {
    const { invoice_id } = req.query;

    if (!invoice_id) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: String(invoice_id) },
      include: { customer: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (Number(invoice.amount_due) <= 0) {
      return res.status(400).json({ error: 'Invoice is already fully paid' });
    }

    const upiId = process.env.UPI_ID;
    const payeeName = process.env.UPI_PAYEE_NAME || 'Zenon Agro';

    if (!upiId) {
      return res.status(500).json({
        error: 'UPI ID is not configured. Please set UPI_ID in environment variables.',
      });
    }

    const amount = Number(invoice.amount_due).toFixed(2);
    const transactionNote = `Payment for ${invoice.invoice_number}`;

    // Construct standard UPI deep-link URI
    const upiUri =
      `upi://pay?pa=${encodeURIComponent(upiId)}` +
      `&pn=${encodeURIComponent(payeeName)}` +
      `&am=${amount}` +
      `&cu=INR` +
      `&tn=${encodeURIComponent(transactionNote)}`;

    res.json({
      upi_uri: upiUri,
      upi_id: upiId,
      payee_name: payeeName,
      amount: Number(amount),
      currency: 'INR',
      invoice_number: invoice.invoice_number,
      customer_name:
        invoice.customer?.company_name || invoice.customer?.client_name || 'N/A',
    });
  } catch (error: any) {
    logger.error('Get UPI QR data error:', error);
    res.status(500).json({ error: error.message || 'Failed to get UPI QR data' });
  }
}
