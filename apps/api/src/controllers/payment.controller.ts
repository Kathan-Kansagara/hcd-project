import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function recordPayment(req: AuthRequest, res: Response) {
  try {
    const {
      invoice_id,
      payment_date,
      amount,
      payment_method,
      reference_number,
      notes,
    } = req.body;

    // Validate required fields
    if (!invoice_id || !payment_date || amount === undefined || amount === null || !payment_method) {
      return res.status(400).json({
        error: 'Invoice ID, payment date, amount, and payment method are required',
      });
    }

    // Get invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoice_id },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Validate payment amount
    const paymentAmount = Number(amount);
    if (paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    if (paymentAmount > Number(invoice.amount_due)) {
      return res.status(400).json({
        error: `Payment amount (${paymentAmount}) exceeds outstanding amount (${invoice.amount_due})`,
      });
    }

    // Generate payment number: PAY-YYYY-###
    const year = new Date(payment_date).getFullYear();
    const count = await prisma.payment.count({
      where: {
        payment_number: {
          startsWith: `PAY-${year}-`,
        },
      },
    });
    const paddedNumber = String(count + 1).padStart(3, '0');
    let payment_number = `PAY-${year}-${paddedNumber}`;

    // Ensure uniqueness
    let suffix = 1;
    while (await prisma.payment.findUnique({ where: { payment_number } })) {
      payment_number = `PAY-${year}-${paddedNumber}-${suffix}`;
      suffix++;
    }

    // Create payment and update invoice in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          payment_number,
          invoice_id,
          customer_id: invoice.customer_id,
          payment_date: new Date(payment_date),
          amount: paymentAmount,
          payment_method,
          reference_number,
          notes,
          created_by: req.user!.userId,
        },
      });

      // Calculate new totals
      const newAmountPaid = Number(invoice.amount_paid) + paymentAmount;
      const newAmountDue = Number(invoice.amount_due) - paymentAmount;

      // Determine new status
      let newStatus = invoice.status;
      if (newAmountDue === 0) {
        newStatus = 'PAID';
      } else if (newAmountPaid > 0 && newAmountDue > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      // Update invoice
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

    logger.info(`Payment recorded: ${result.payment.id} for invoice ${invoice.invoice_number}`, {
      payment_id: result.payment.id,
      amount: paymentAmount,
    });

    res.status(201).json(result);
  } catch (error: any) {
    logger.error('Record payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to record payment' });
  }
}

export async function getPayments(req: AuthRequest, res: Response) {
  try {
    const {
      invoice_id,
      payment_method,
      from_date,
      to_date,
      search,
      page = '1',
      limit = '20',
      sortBy,
      sortOrder,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (invoice_id) {
      where.invoice_id = String(invoice_id);
    }

    if (payment_method) {
      where.payment_method = String(payment_method);
    }

    if (from_date || to_date) {
      where.payment_date = {};
      if (from_date) {
        where.payment_date.gte = new Date(String(from_date));
      }
      if (to_date) {
        where.payment_date.lte = new Date(String(to_date));
      }
    }

    // Search by payment number, invoice number, customer name
    if (search) {
      where.OR = [
        { payment_number: { contains: String(search), mode: 'insensitive' } },
        { invoice: { invoice_number: { contains: String(search), mode: 'insensitive' } } },
        { invoice: { customer: { company_name: { contains: String(search), mode: 'insensitive' } } } },
      ];
    }

    // Server-side sorting
    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      payment_number: { payment_number: sortDir },
      payment_date: { payment_date: sortDir },
      amount: { amount: sortDir },
      payment_method: { payment_method: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { payment_date: 'desc' };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          invoice: {
            select: {
              id: true,
              invoice_number: true,
              customer: {
                select: {
                  id: true,
                  company_name: true,
                  client_name: true,
                },
              },
            },
          },
          creator: { select: { id: true, name: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      payments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to get payments' });
  }
}

export async function getPaymentById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ payment });
  } catch (error) {
    logger.error('Get payment by ID error:', error);
    res.status(500).json({ error: 'Failed to get payment' });
  }
}

export async function deletePayment(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Get payment
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Delete payment and update invoice in transaction
    await prisma.$transaction(async (tx) => {
      // Delete payment
      await tx.payment.delete({
        where: { id },
      });

      // Recalculate invoice totals
      const invoice = payment.invoice;
      const newAmountPaid = Number(invoice.amount_paid) - Number(payment.amount);
      const newAmountDue = Number(invoice.amount_due) + Number(payment.amount);

      // Determine new status
      let newStatus = invoice.status;
      if (newAmountPaid === 0) {
        newStatus = 'SENT';
      } else if (newAmountPaid > 0 && newAmountDue > 0) {
        newStatus = 'PARTIALLY_PAID';
      } else if (newAmountDue === 0) {
        newStatus = 'PAID';
      }

      // Update invoice
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newStatus,
        },
      });
    });

    logger.info(`Payment deleted: ${id}`, { payment_id: id });
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    logger.error('Delete payment error:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
}
