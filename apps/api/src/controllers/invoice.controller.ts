import { Response } from 'express';
import { prisma, Prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';
import { generateInvoicePDF } from '../utils/invoice-pdf.js';

// Helper function to extract state code from place_of_supply (e.g., "24-Gujarat" → "24")
function getStateCode(placeOfSupply: string): string {
  return placeOfSupply.split('-')[0];
}

// Helper function to split GST based on state
function calculateGST(totalGst: number, customerState: string, companyState: string) {
  const isIntraState = customerState === companyState;

  if (isIntraState) {
    // Same state: Split into CGST and SGST
    return {
      cgst_amount: totalGst / 2,
      sgst_amount: totalGst / 2,
      igst_amount: 0,
    };
  } else {
    // Different states: Use IGST
    return {
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: totalGst,
    };
  }
}

export async function createInvoiceFromDeliveryNote(req: AuthRequest, res: Response) {
  try {
    const {
      delivery_note_id,
      sales_order_id,
      invoice_date,
      due_date,
      discount_amount = 0,
      discount_percentage = 0,
      payment_terms_days = 30,
      notes,
    } = req.body;

    // Validate required fields - need either delivery_note_id or sales_order_id
    if (!invoice_date) {
      return res.status(400).json({
        error: 'Invoice date is required',
      });
    }

    if (!delivery_note_id && !sales_order_id) {
      return res.status(400).json({
        error: 'Either delivery_note_id or sales_order_id is required',
      });
    }

    // Get company settings for GST calculation
    const companySettings = await prisma.companySettings.findFirst();
    if (!companySettings) {
      return res.status(500).json({ error: 'Company settings not configured' });
    }

    const companyStateCode = getStateCode(companySettings.state);

    let resolvedSalesOrderId: string;
    let resolvedDeliveryNoteId: string | null = null;
    let customerId: string;
    let customerPlaceOfSupply: string;
    let itemsBase: any[];

    if (delivery_note_id) {
      // --- Create invoice from Delivery Note ---
      const deliveryNote = await prisma.deliveryNote.findUnique({
        where: { id: delivery_note_id },
        include: {
          sales_order: {
            include: {
              items: true,
            },
          },
          customer_rel: true,
          items: {
            include: {
              sales_order_item: true,
            },
          },
        },
      });

      if (!deliveryNote) {
        return res.status(404).json({ error: 'Delivery note not found' });
      }

      // Check if invoice already exists for this DN
      const existingInvoice = await prisma.invoice.findFirst({
        where: { delivery_note_id },
      });

      if (existingInvoice) {
        return res.status(400).json({ error: 'Invoice already exists for this delivery note' });
      }

      resolvedSalesOrderId = deliveryNote.sales_order_id;
      resolvedDeliveryNoteId = deliveryNote.id;
      customerId = deliveryNote.customer_id;
      customerPlaceOfSupply = deliveryNote.customer_rel.place_of_supply;

      // Prepare invoice items from delivery note
      itemsBase = deliveryNote.items.map((item, index) => {
        const soItem = item.sales_order_item;
        const amount = Number(item.quantity_delivered) * Number(soItem.unit_price);

        return {
          sr_no: index + 1,
          product_name: soItem.product_name,
          hsn_sac_code: soItem.hsn_sac_code,
          quantity: item.quantity_delivered,
          unit: soItem.unit,
          rate: soItem.unit_price,
          gst_rate: soItem.gst_rate,
          amount,
        };
      });
    } else {
      // --- Create invoice directly from Sales Order ---
      const salesOrder = await prisma.salesOrder.findUnique({
        where: { id: sales_order_id },
        include: {
          items: true,
          customer_rel: true,
        },
      });

      if (!salesOrder) {
        return res.status(404).json({ error: 'Sales order not found' });
      }

      // Check if invoice already exists for this SO (without DN)
      const existingInvoice = await prisma.invoice.findFirst({
        where: { sales_order_id, delivery_note_id: null },
      });

      if (existingInvoice) {
        return res.status(400).json({ error: 'Invoice already exists for this sales order' });
      }

      resolvedSalesOrderId = salesOrder.id;
      customerId = salesOrder.customer_id;
      customerPlaceOfSupply = salesOrder.customer_rel.place_of_supply;

      // Prepare invoice items from sales order items
      itemsBase = salesOrder.items.map((item, index) => {
        const amount = Number(item.quantity) * Number(item.unit_price);

        return {
          sr_no: index + 1,
          product_name: item.product_name,
          hsn_sac_code: item.hsn_sac_code,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.unit_price,
          gst_rate: item.gst_rate,
          amount,
        };
      });
    }

    const customerStateCode = getStateCode(customerPlaceOfSupply);

    // Generate invoice number: INV-YYYY-###
    const year = new Date(invoice_date).getFullYear();
    const count = await prisma.invoice.count({
      where: {
        invoice_number: {
          startsWith: `INV-${year}-`,
        },
      },
    });
    const paddedNumber = String(count + 1).padStart(3, '0');
    let invoice_number = `INV-${year}-${paddedNumber}`;

    // Ensure uniqueness
    let suffix = 1;
    while (await prisma.invoice.findUnique({ where: { invoice_number } })) {
      invoice_number = `INV-${year}-${paddedNumber}-${suffix}`;
      suffix++;
    }

    // Calculate sub_total
    const sub_total = itemsBase.reduce((sum, item) => sum + Number(item.amount), 0);

    // Apply discount
    let discountAmt = Number(discount_amount);
    if (Number(discount_percentage) > 0) {
      discountAmt = sub_total * (Number(discount_percentage) / 100);
    }

    const taxable_amount = sub_total - discountAmt;

    // Calculate GST on taxable amount and distribute to items proportionally
    const invoiceItems = itemsBase.map((item) => {
      // Calculate item's share of taxable amount (after proportional discount)
      const itemTaxableAmount = sub_total > 0 ? (Number(item.amount) / sub_total) * taxable_amount : 0;
      const gstAmount = itemTaxableAmount * (Number(item.gst_rate) / 100);
      const gstSplit = calculateGST(gstAmount, customerStateCode, companyStateCode);

      return {
        ...item,
        cgst_amount: gstSplit.cgst_amount,
        sgst_amount: gstSplit.sgst_amount,
        igst_amount: gstSplit.igst_amount,
      };
    });

    const total_cgst = invoiceItems.reduce((sum, item) => sum + Number(item.cgst_amount), 0);
    const total_sgst = invoiceItems.reduce((sum, item) => sum + Number(item.sgst_amount), 0);
    const total_igst = invoiceItems.reduce((sum, item) => sum + Number(item.igst_amount), 0);
    const total_gst = total_cgst + total_sgst + total_igst;

    // Calculate grand total and round off
    const calculatedTotal = taxable_amount + total_gst;
    const grand_total = Math.round(calculatedTotal);
    const round_off = grand_total - calculatedTotal;

    // Calculate due date if not provided
    const calculatedDueDate = due_date
      ? new Date(due_date)
      : new Date(new Date(invoice_date).getTime() + payment_terms_days * 24 * 60 * 60 * 1000);

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoice_number,
        sales_order_id: resolvedSalesOrderId,
        delivery_note_id: resolvedDeliveryNoteId,
        customer_id: customerId,
        invoice_date: new Date(invoice_date),
        due_date: calculatedDueDate,
        place_of_supply: customerPlaceOfSupply,
        sub_total,
        discount_amount: discountAmt,
        taxable_amount,
        cgst_amount: total_cgst,
        sgst_amount: total_sgst,
        igst_amount: total_igst,
        total_gst,
        round_off,
        grand_total,
        amount_paid: 0,
        amount_due: grand_total,
        status: 'SENT',
        notes,
        created_by: req.user!.userId,
        items: {
          create: invoiceItems,
        },
      },
      include: {
        items: true,
        customer: {
          include: {
            location: true,
          },
        },
        sales_order: true,
        delivery_note: true,
      },
    });

    logger.info(`Invoice created: ${invoice_number}`, { invoice_id: invoice.id });
    res.status(201).json({ invoice });
  } catch (error: any) {
    logger.error('Create invoice error:', error);
    res.status(500).json({ error: error.message || 'Failed to create invoice' });
  }
}

export async function getInvoices(req: AuthRequest, res: Response) {
  try {
    const {
      customer_id,
      status,
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

    if (customer_id) {
      where.customer_id = String(customer_id);
    }

    if (status) {
      where.status = String(status);
    }

    if (from_date || to_date) {
      where.invoice_date = {};
      if (from_date) {
        where.invoice_date.gte = new Date(String(from_date));
      }
      if (to_date) {
        where.invoice_date.lte = new Date(String(to_date));
      }
    }

    // Search by invoice number, customer name
    if (search) {
      where.OR = [
        { invoice_number: { contains: String(search), mode: 'insensitive' } },
        { customer: { company_name: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    // Server-side sorting
    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      invoice_number: { invoice_number: sortDir },
      invoice_date: { invoice_date: sortDir },
      due_date: { due_date: sortDir },
      grand_total: { grand_total: sortDir },
      status: { status: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { invoice_date: 'desc' };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          customer: {
            include: {
              location: true,
            },
          },
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
          items: {
            select: {
              id: true,
              product_name: true,
              quantity: true,
              unit: true,
              amount: true,
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      invoices,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
}

export async function getInvoiceByNumber(req: AuthRequest, res: Response) {
  try {
    const { invoiceNumber } = req.params;

    if (!invoiceNumber) {
      return res.status(400).json({ error: 'Invoice number is required' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_number: invoiceNumber },
      include: {
        customer: {
          include: {
            location: true,
          },
        },
        sales_order: {
          select: {
            id: true,
            so_number: true,
          },
        },
        delivery_note: {
          select: {
            id: true,
            dn_number: true,
          },
        },
        items: true,
        payments: {
          orderBy: { payment_date: 'desc' },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ invoice });
  } catch (error) {
    logger.error('Get invoice by number error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
}

export async function getInvoiceById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            location: true,
          },
        },
        sales_order: {
          select: {
            id: true,
            so_number: true,
          },
        },
        delivery_note: {
          select: {
            id: true,
            dn_number: true,
          },
        },
        items: true,
        payments: {
          orderBy: { payment_date: 'desc' },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ invoice });
  } catch (error) {
    logger.error('Get invoice by ID error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
}

export async function updateInvoice(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { invoice_date, due_date, discount_amount, discount_percentage, notes, status } = req.body;

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existingInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Only allow updates if status is DRAFT or SENT
    const editableStatuses = ['DRAFT', 'SENT'];
    if (!editableStatuses.includes(existingInvoice.status)) {
      return res.status(400).json({ error: 'Cannot update invoice with status ' + existingInvoice.status });
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };
    if (invoice_date) updateData.invoice_date = new Date(invoice_date);
    if (due_date) updateData.due_date = new Date(due_date);
    if (discount_amount !== undefined) updateData.discount_amount = discount_amount;
    if (discount_percentage !== undefined) updateData.discount_percentage = discount_percentage;
    if (notes !== undefined) updateData.notes = notes;

    // Allow status transitions: DRAFT->SENT, SENT->CANCELLED, DRAFT->CANCELLED
    if (status) {
      const allowedTransitions: Record<string, string[]> = {
        DRAFT: ['SENT', 'CANCELLED'],
        SENT: ['CANCELLED'],
      };
      const allowed = allowedTransitions[existingInvoice.status] || [];
      if (allowed.includes(status)) {
        updateData.status = status;
      } else if (status !== existingInvoice.status) {
        return res.status(400).json({
          error: `Cannot change status from ${existingInvoice.status} to ${status}`,
        });
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          include: {
            location: true,
          },
        },
        items: true,
      },
    });

    logger.info(`Invoice updated: ${invoice.invoice_number}`, { invoice_id: id });
    res.json({ invoice });
  } catch (error) {
    logger.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
}

export async function downloadInvoicePDF(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Fetch invoice with all related data
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            location: true,
          },
        },
        sales_order: {
          select: {
            so_number: true,
          },
        },
        delivery_note: {
          select: {
            dn_number: true,
          },
        },
        items: {
          orderBy: { sr_no: 'asc' },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Fetch company settings
    const companySettings = await prisma.companySettings.findFirst();
    if (!companySettings) {
      return res.status(500).json({ error: 'Company settings not configured' });
    }

    // Prepare data for PDF generation
    const pdfData = {
      invoice: {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date.toISOString(),
        due_date: invoice.due_date.toISOString(),
        place_of_supply: invoice.place_of_supply,
        sub_total: Number(invoice.sub_total),
        discount_amount: Number(invoice.discount_amount),
        taxable_amount: Number(invoice.taxable_amount),
        cgst_amount: Number(invoice.cgst_amount),
        sgst_amount: Number(invoice.sgst_amount),
        igst_amount: Number(invoice.igst_amount),
        total_gst: Number(invoice.total_gst),
        round_off: Number(invoice.round_off),
        grand_total: Number(invoice.grand_total),
        amount_paid: Number(invoice.amount_paid),
        amount_due: Number(invoice.amount_due),
        notes: invoice.notes || undefined,
        customer: {
          company_name: invoice.customer.company_name || '',
          client_name: invoice.customer.client_name || undefined,
          address_line1: invoice.customer.address_line1,
          address_line2: invoice.customer.address_line2 || undefined,
          city: invoice.customer.location?.city || '',
          state: invoice.customer.location?.state || '',
          pincode: invoice.customer.location?.pincode || '',
          gstin: invoice.customer.gstin || undefined,
        },
        items: invoice.items.map((item) => ({
          sr_no: item.sr_no,
          product_name: item.product_name,
          hsn_sac_code: item.hsn_sac_code,
          quantity: Number(item.quantity),
          unit: item.unit,
          rate: Number(item.rate),
          gst_rate: Number(item.gst_rate),
          amount: Number(item.amount),
          cgst_amount: Number(item.cgst_amount),
          sgst_amount: Number(item.sgst_amount),
          igst_amount: Number(item.igst_amount),
        })),
        sales_order: invoice.sales_order
          ? {
              so_number: invoice.sales_order.so_number,
            }
          : undefined,
        delivery_note: invoice.delivery_note
          ? {
              dn_number: invoice.delivery_note.dn_number,
            }
          : undefined,
      },
      companySettings: {
        company_name: companySettings.company_name,
        address_line1: companySettings.address_line1,
        address_line2: companySettings.address_line2 || undefined,
        city: companySettings.city,
        state: companySettings.state,
        pincode: companySettings.pincode,
        gstin: companySettings.gstin,
        bank_name: companySettings.bank_name,
        bank_account_number: companySettings.bank_account_number,
        ifsc_code: companySettings.ifsc_code,
        invoice_terms_and_conditions: companySettings.invoice_terms_and_conditions || undefined,
      },
    };

    // Generate PDF
    const pdfStream = generateInvoicePDF(pdfData);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);

    // Pipe PDF stream to response
    pdfStream.pipe(res);

    logger.info(`Invoice PDF downloaded: ${invoice.invoice_number}`, { invoice_id: id });
  } catch (error) {
    logger.error('Download invoice PDF error:', error);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
}
