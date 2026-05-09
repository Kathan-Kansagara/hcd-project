import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay client. Using dummy values if not provided in env for safety/testing
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummykey123',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummysecret123',
});

export async function createRazorpayOrder(req: AuthRequest, res: Response) {
  try {
    const { invoice_id } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoice_id },
      include: { customer: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (Number(invoice.amount_due) <= 0) {
      return res.status(400).json({ error: 'Invoice is already fully paid or has no amount due' });
    }

    // Razorpay amount is in minimum denominaton (paise for INR)
    const amountInPaise = Math.round(Number(invoice.amount_due) * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${invoice.invoice_number}`,
      notes: {
        invoice_id: invoice.id,
      } // Store invoice id in notes for reference
    };

    const order = await razorpay.orders.create(options);
    
    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummykey123'
    });

  } catch (error: any) {
    logger.error('Create Razorpay order error:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment order' });
  }
}

export async function verifyRazorpayPayment(req: AuthRequest, res: Response) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      invoice_id,
      amount
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoice_id) {
      return res.status(400).json({ error: 'Missing required payment verification parameters' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret123';
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Validate invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoice_id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const paymentAmount = Number(amount) || Number(invoice.amount_due);

    // Generate payment number: PAY-YYYY-###
    const year = new Date().getFullYear();
    const count = await prisma.payment.count({
      where: {
        payment_number: { startsWith: `PAY-${year}-` },
      },
    });
    const paddedNumber = String(count + 1).padStart(3, '0');
    let payment_number = `PAY-${year}-${paddedNumber}`;
    let suffix = 1;
    while (await prisma.payment.findUnique({ where: { payment_number } })) {
      payment_number = `PAY-${year}-${paddedNumber}-${suffix}`;
      suffix++;
    }

    // Create payment in DB
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record mapping to the invoice
      const payment = await tx.payment.create({
        data: {
          payment_number,
          invoice_id,
          customer_id: invoice.customer_id,
          payment_date: new Date(),
          amount: paymentAmount,
          payment_method: 'UPI', // Default to UPI for razorpay online for simplicity, or grab from hook if available
          reference_number: razorpay_payment_id,
          notes: `Razorpay Order ID: ${razorpay_order_id}`,
          created_by: req.user!.userId,
        },
      });

      // 2. Recalculate amounts
      const newAmountPaid = Number(invoice.amount_paid) + paymentAmount;
      const newAmountDue = Number(invoice.amount_due) - paymentAmount;

      let newStatus = invoice.status;
      if (newAmountDue <= 0) {
        newStatus = 'PAID';
      } else if (newAmountPaid > 0 && newAmountDue > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice_id },
        data: {
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newStatus,
        },
      });

      return { payment, invoice: updatedInvoice };
    });

    res.json({ success: true, payment: result.payment, invoice: result.invoice });

  } catch (error: any) {
    logger.error('Verify payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify payment' });
  }
}
