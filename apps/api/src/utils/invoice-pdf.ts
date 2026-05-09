import PDFDocument from 'pdfkit';

interface InvoiceData {
  invoice: {
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    place_of_supply: string;
    sub_total: number;
    discount_amount: number;
    taxable_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total_gst: number;
    round_off: number;
    grand_total: number;
    amount_paid: number;
    amount_due: number;
    notes?: string;
    customer: {
      company_name: string;
      client_name?: string;
      address_line1: string;
      address_line2?: string;
      city: string;
      state: string;
      pincode: string;
      gstin?: string;
    };
    items: Array<{
      sr_no: number;
      product_name: string;
      hsn_sac_code: string;
      quantity: number;
      unit: string;
      rate: number;
      gst_rate: number;
      amount: number;
      cgst_amount: number;
      sgst_amount: number;
      igst_amount: number;
    }>;
    sales_order?: {
      so_number: string;
    };
    delivery_note?: {
      dn_number: string;
    };
  };
  companySettings: {
    company_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    pincode: string;
    gstin: string;
    bank_name: string;
    bank_account_number: string;
    ifsc_code: string;
    invoice_terms_and_conditions?: string;
  };
}

// Convert number to words in Indian format
function numberToWords(num: number): string {
  if (num === 0) return 'Zero Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertBelowHundred(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }

  function convertBelowThousand(n: number): string {
    if (n < 100) return convertBelowHundred(n);
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelowHundred(n % 100) : '');
  }

  const absNum = Math.abs(Math.round(num));
  const crore = Math.floor(absNum / 10000000);
  const lakh = Math.floor((absNum % 10000000) / 100000);
  const thousand = Math.floor((absNum % 100000) / 1000);
  const remainder = absNum % 1000;

  let result = '';
  if (crore > 0) result += convertBelowThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertBelowThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertBelowThousand(thousand) + ' Thousand ';
  if (remainder > 0) result += convertBelowThousand(remainder);

  // Handle paise
  const paise = Math.round((num - Math.floor(num)) * 100);
  if (paise > 0) {
    result += ' And ' + convertBelowHundred(paise) + ' Paise';
  }

  return result.trim() + ' Only';
}

function formatNumber(num: number, decimals = 2): string {
  return num.toFixed(decimals);
}

function formatIndianNumber(num: number, decimals = 2): string {
  const parts = num.toFixed(decimals).split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  // Indian number formatting: last 3 digits, then groups of 2
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    const groups: string[] = [];
    while (remaining.length > 2) {
      groups.unshift(remaining.slice(-2));
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) groups.unshift(remaining);
    intPart = groups.join(',') + ',' + last3;
  }

  return decPart ? intPart + '.' + decPart : intPart;
}

export function generateInvoicePDF(data: InvoiceData): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 30, bottom: 30, left: 30, right: 30 },
  });

  const { invoice, companySettings } = data;
  const pageWidth = 595.28; // A4 width in points
  const leftMargin = 30;
  const rightMargin = 565;
  const contentWidth = rightMargin - leftMargin;

  // Helper to draw a bordered rect
  function drawRect(x: number, y: number, w: number, h: number, options?: { fill?: string; stroke?: boolean }) {
    if (options?.fill) {
      doc.save().rect(x, y, w, h).fill(options.fill).restore();
    }
    if (options?.stroke !== false) {
      doc.rect(x, y, w, h).stroke();
    }
  }

  // Helper to draw horizontal line
  function drawLine(x1: number, y1: number, x2: number, y2: number) {
    doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
  }

  // Helper to draw text in a cell
  function cellText(text: string, x: number, y: number, width: number, options?: {
    align?: 'left' | 'center' | 'right';
    font?: string;
    fontSize?: number;
    bold?: boolean;
  }) {
    const font = options?.bold ? 'Helvetica-Bold' : (options?.font || 'Helvetica');
    const fontSize = options?.fontSize || 9;
    doc.font(font).fontSize(fontSize);
    doc.text(text, x + 3, y + 3, {
      width: width - 6,
      align: options?.align || 'left',
    });
  }

  doc.lineWidth(0.5);

  // ============================================================
  // OUTER BORDER
  // ============================================================
  drawRect(leftMargin, 25, contentWidth, 785);

  // ============================================================
  // COMPANY HEADER (top section)
  // ============================================================
  const headerTop = 25;
  const headerHeight = 55;
  drawRect(leftMargin, headerTop, contentWidth, headerHeight);

  // Company name - centered, large and bold
  doc.font('Helvetica-Bold').fontSize(16);
  doc.text(companySettings.company_name.toUpperCase(), leftMargin, headerTop + 8, {
    width: contentWidth,
    align: 'center',
  });

  // Company address
  doc.font('Helvetica').fontSize(8);
  const addressParts = [companySettings.address_line1];
  if (companySettings.address_line2) addressParts.push(companySettings.address_line2);
  addressParts.push(`${companySettings.city}, ${companySettings.state} - ${companySettings.pincode}`);
  doc.text(addressParts.join(', '), leftMargin, headerTop + 28, {
    width: contentWidth,
    align: 'center',
  });

  // ============================================================
  // TAX INVOICE TITLE ROW
  // ============================================================
  const titleRowTop = headerTop + headerHeight;
  const titleRowHeight = 18;
  drawRect(leftMargin, titleRowTop, contentWidth, titleRowHeight);

  // "Debit Memo" on left
  doc.font('Helvetica').fontSize(8);
  doc.text('Debit Memo', leftMargin + 5, titleRowTop + 4);

  // TAX INVOICE centered
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text('TAX INVOICE', leftMargin, titleRowTop + 2, {
    width: contentWidth,
    align: 'center',
  });

  // "Original" on right
  doc.font('Helvetica').fontSize(8);
  doc.text('Original', rightMargin - 55, titleRowTop + 4);

  // ============================================================
  // CUSTOMER + INVOICE DETAILS ROW
  // ============================================================
  const custRowTop = titleRowTop + titleRowHeight;
  const custRowHeight = 80;
  const invoiceDetailWidth = 200;
  const custWidth = contentWidth - invoiceDetailWidth;

  // Customer section (left)
  drawRect(leftMargin, custRowTop, custWidth, custRowHeight);

  // Invoice detail section (right)
  drawRect(leftMargin + custWidth, custRowTop, invoiceDetailWidth, custRowHeight);

  // Customer info
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('M/s. :', leftMargin + 5, custRowTop + 5);

  const customerName = invoice.customer.company_name || invoice.customer.client_name || '';
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text(customerName.toUpperCase(), leftMargin + 40, custRowTop + 5, { width: custWidth - 50 });

  let custY = custRowTop + 18;
  doc.font('Helvetica').fontSize(8);
  doc.text(invoice.customer.address_line1, leftMargin + 40, custY, { width: custWidth - 50 });
  custY += 10;
  if (invoice.customer.address_line2) {
    doc.text(invoice.customer.address_line2, leftMargin + 40, custY, { width: custWidth - 50 });
    custY += 10;
  }
  const cityState = `${invoice.customer.city} - ${invoice.customer.pincode}`;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text(cityState, leftMargin + 40, custY, { width: custWidth - 50 });
  custY += 14;

  if (invoice.customer.gstin) {
    doc.font('Helvetica').fontSize(8);
    doc.text(`GSTIN No.: ${invoice.customer.gstin}`, leftMargin + 5, custY);
  }

  // Place of supply
  const placeOfSupply = invoice.place_of_supply || '';
  doc.text(`Place of Supply :${placeOfSupply}`, leftMargin + 180, custY);

  // Invoice details (right box)
  const invDetailX = leftMargin + custWidth;
  const midInvDetail = 30;

  // Invoice No row
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Invoice No.', invDetailX + 5, custRowTop + 5);
  doc.text(':', invDetailX + midInvDetail + 40, custRowTop + 5);
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text(invoice.invoice_number, invDetailX + midInvDetail + 48, custRowTop + 5);

  // Date row
  drawLine(invDetailX, custRowTop + 18, invDetailX + invoiceDetailWidth, custRowTop + 18);
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Date', invDetailX + 5, custRowTop + 22);
  doc.text(':', invDetailX + midInvDetail + 40, custRowTop + 22);
  const invoiceDate = new Date(invoice.invoice_date);
  doc.font('Helvetica').fontSize(9);
  doc.text(
    `${String(invoiceDate.getDate()).padStart(2, '0')}/${String(invoiceDate.getMonth() + 1).padStart(2, '0')}/${invoiceDate.getFullYear()}`,
    invDetailX + midInvDetail + 48,
    custRowTop + 22,
  );

  // Due date row
  drawLine(invDetailX, custRowTop + 36, invDetailX + invoiceDetailWidth, custRowTop + 36);
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Due Date', invDetailX + 5, custRowTop + 40);
  doc.text(':', invDetailX + midInvDetail + 40, custRowTop + 40);
  const dueDate = new Date(invoice.due_date);
  doc.font('Helvetica').fontSize(9);
  doc.text(
    `${String(dueDate.getDate()).padStart(2, '0')}/${String(dueDate.getMonth() + 1).padStart(2, '0')}/${dueDate.getFullYear()}`,
    invDetailX + midInvDetail + 48,
    custRowTop + 40,
  );

  // SO/DN numbers
  if (invoice.sales_order) {
    drawLine(invDetailX, custRowTop + 54, invDetailX + invoiceDetailWidth, custRowTop + 54);
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('SO No.', invDetailX + 5, custRowTop + 58);
    doc.text(':', invDetailX + midInvDetail + 40, custRowTop + 58);
    doc.font('Helvetica').fontSize(8);
    doc.text(invoice.sales_order.so_number, invDetailX + midInvDetail + 48, custRowTop + 58);
  }

  if (invoice.delivery_note) {
    drawLine(invDetailX, custRowTop + 68, invDetailX + invoiceDetailWidth, custRowTop + 68);
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('DN No.', invDetailX + 5, custRowTop + 72);
    doc.text(':', invDetailX + midInvDetail + 40, custRowTop + 72);
    doc.font('Helvetica').fontSize(8);
    doc.text(invoice.delivery_note.dn_number, invDetailX + midInvDetail + 48, custRowTop + 72);
  }

  // ============================================================
  // ITEMS TABLE
  // ============================================================
  const tableTop = custRowTop + custRowHeight;
  const tableHeaderHeight = 18;

  // Column definitions - matching the reference image layout
  const cols = {
    srNo: { x: leftMargin, w: 30 },
    product: { x: leftMargin + 30, w: 175 },
    hsn: { x: leftMargin + 205, w: 60 },
    qty: { x: leftMargin + 265, w: 70 },
    rate: { x: leftMargin + 335, w: 70 },
    gst: { x: leftMargin + 405, w: 50 },
    amount: { x: leftMargin + 455, w: 80 },
  };

  // Table header background
  drawRect(leftMargin, tableTop, contentWidth, tableHeaderHeight, { fill: '#f0f0f0' });
  drawRect(leftMargin, tableTop, contentWidth, tableHeaderHeight);

  // Draw column separators for header
  Object.values(cols).forEach((col, idx) => {
    if (idx > 0) {
      drawLine(col.x, tableTop, col.x, tableTop + tableHeaderHeight);
    }
  });

  // Header text
  doc.font('Helvetica-Bold').fontSize(8);

  const headerTexts = [
    { text: 'SrNo', col: cols.srNo, align: 'center' as const },
    { text: 'Product Name', col: cols.product, align: 'center' as const },
    { text: 'HSN/SAC', col: cols.hsn, align: 'center' as const },
    { text: `Qty (${invoice.items[0]?.unit || 'KG'})`, col: cols.qty, align: 'center' as const },
    { text: `Rate / ${invoice.items[0]?.unit || 'KG'}`, col: cols.rate, align: 'center' as const },
    { text: 'GST %', col: cols.gst, align: 'center' as const },
    { text: 'Amount Rs.', col: cols.amount, align: 'center' as const },
  ];

  headerTexts.forEach(({ text, col, align }) => {
    doc.text(text, col.x + 2, tableTop + 4, { width: col.w - 4, align });
  });

  // Draw item rows
  const rowHeight = 22;
  let currentY = tableTop + tableHeaderHeight;

  invoice.items.forEach((item) => {
    drawRect(leftMargin, currentY, contentWidth, rowHeight);

    // Column separators
    Object.values(cols).forEach((col, idx) => {
      if (idx > 0) {
        drawLine(col.x, currentY, col.x, currentY + rowHeight);
      }
    });

    doc.font('Helvetica').fontSize(8);

    // SrNo
    doc.text(item.sr_no.toString(), cols.srNo.x + 2, currentY + 6, { width: cols.srNo.w - 4, align: 'center' });

    // Product name
    doc.text(item.product_name.toUpperCase(), cols.product.x + 4, currentY + 6, { width: cols.product.w - 8 });

    // HSN/SAC
    doc.text(item.hsn_sac_code, cols.hsn.x + 2, currentY + 6, { width: cols.hsn.w - 4, align: 'center' });

    // Quantity
    doc.text(formatNumber(item.quantity, 3), cols.qty.x + 2, currentY + 6, { width: cols.qty.w - 4, align: 'right' });

    // Rate
    doc.text(formatNumber(item.rate, 2), cols.rate.x + 2, currentY + 6, { width: cols.rate.w - 4, align: 'right' });

    // GST %
    doc.text(formatNumber(item.gst_rate, 2), cols.gst.x + 2, currentY + 6, { width: cols.gst.w - 4, align: 'right' });

    // Amount
    doc.text(formatNumber(item.amount, 2), cols.amount.x + 2, currentY + 6, { width: cols.amount.w - 4, align: 'right' });

    currentY += rowHeight;
  });

  // Empty rows to fill space (minimum 5 total rows)
  const minRows = Math.max(5, invoice.items.length);
  for (let i = invoice.items.length; i < minRows; i++) {
    drawRect(leftMargin, currentY, contentWidth, rowHeight);
    Object.values(cols).forEach((col, idx) => {
      if (idx > 0) {
        drawLine(col.x, currentY, col.x, currentY + rowHeight);
      }
    });
    currentY += rowHeight;
  }

  // ============================================================
  // GSTIN / FSSAI ROW + SUB TOTAL
  // ============================================================
  const gstinRowTop = currentY;
  const gstinRowHeight = 18;
  // Totals section: label area + value area on the right side
  const totalColX = cols.qty.x; // Where totals section starts (left edge)
  const totalValX = cols.amount.x; // Where values column starts

  drawRect(leftMargin, gstinRowTop, totalColX - leftMargin, gstinRowHeight);
  drawRect(totalColX, gstinRowTop, rightMargin - totalColX, gstinRowHeight);

  // GSTIN
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text(`GSTIN No.:  ${companySettings.gstin}`, leftMargin + 5, gstinRowTop + 4);

  // Sub Total
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Sub Total', totalColX + 4, gstinRowTop + 4);
  doc.text(formatIndianNumber(invoice.sub_total), totalValX + 2, gstinRowTop + 4, {
    width: rightMargin - totalValX - 4,
    align: 'right',
  });

  currentY = gstinRowTop + gstinRowHeight;

  // ============================================================
  // BANK DETAILS (LEFT) + TOTALS (RIGHT)
  // ============================================================
  const bankTotalTop = currentY;
  // Calculate needed height for totals
  let totalRows = 2; // Taxable Amount + Grand Total
  if (invoice.discount_amount > 0) totalRows++;
  if (invoice.cgst_amount > 0) totalRows += 2; // CGST + SGST
  if (invoice.igst_amount > 0) totalRows++;
  if (Math.abs(invoice.round_off) > 0.001) totalRows++;
  const totalsHeight = totalRows * 16 + 4;

  const bankSectionHeight = Math.max(totalsHeight, 80);

  drawRect(leftMargin, bankTotalTop, totalColX - leftMargin, bankSectionHeight);
  drawRect(totalColX, bankTotalTop, rightMargin - totalColX, bankSectionHeight);

  // Draw vertical line between label and value in totals
  drawLine(totalValX, bankTotalTop, totalValX, bankTotalTop + bankSectionHeight);

  // Bank details
  let bankY = bankTotalTop + 5;
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('Bank Name', leftMargin + 5, bankY);
  doc.text(`: ${companySettings.bank_name}`, leftMargin + 80, bankY);
  bankY += 13;

  doc.text('Bank A/c. No.', leftMargin + 5, bankY);
  doc.text(`: ${companySettings.bank_account_number}`, leftMargin + 80, bankY);
  bankY += 13;

  doc.text('RTGS/IFSC Code', leftMargin + 5, bankY);
  doc.text(`: ${companySettings.ifsc_code}`, leftMargin + 80, bankY);
  bankY += 16;

  // Note section
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('Note :', leftMargin + 170, bankTotalTop + 5);
  if (invoice.notes) {
    doc.font('Helvetica').fontSize(7);
    doc.text(invoice.notes, leftMargin + 198, bankTotalTop + 5, { width: totalColX - leftMargin - 205 });
  }

  // Totals on the right side
  let totY = bankTotalTop + 5;
  const labelX = totalColX + 4;
  const valX = totalValX + 2;
  const valW = rightMargin - totalValX - 4;

  doc.font('Helvetica').fontSize(8);

  // Discount
  if (invoice.discount_amount > 0) {
    doc.text('Discount', labelX, totY, { width: totalValX - totalColX - 8 });
    doc.text(formatIndianNumber(invoice.discount_amount), valX, totY, { width: valW, align: 'right' });
    totY += 16;
    drawLine(totalColX, totY - 3, rightMargin, totY - 3);
  }

  // Taxable Amount
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('Taxable Amount', labelX, totY, { width: totalValX - totalColX - 8 });
  doc.text(formatIndianNumber(invoice.taxable_amount), valX, totY, { width: valW, align: 'right' });
  totY += 16;
  drawLine(totalColX, totY - 3, rightMargin, totY - 3);

  doc.font('Helvetica').fontSize(8);

  // CGST & SGST (intra-state)
  if (invoice.cgst_amount > 0) {
    const cgstRate = invoice.items[0]?.gst_rate ? (invoice.items[0].gst_rate / 2) : 0;
    doc.text('Central Tax', labelX, totY);
    doc.text(`${formatNumber(cgstRate)}%`, labelX + 80, totY);
    doc.text(formatIndianNumber(invoice.cgst_amount), valX, totY, { width: valW, align: 'right' });
    totY += 16;
    drawLine(totalColX, totY - 3, rightMargin, totY - 3);

    doc.text('State/UT Tax', labelX, totY);
    doc.text(`${formatNumber(cgstRate)}%`, labelX + 80, totY);
    doc.text(formatIndianNumber(invoice.sgst_amount), valX, totY, { width: valW, align: 'right' });
    totY += 16;
    drawLine(totalColX, totY - 3, rightMargin, totY - 3);
  }

  // IGST (inter-state)
  if (invoice.igst_amount > 0) {
    const igstRate = invoice.items[0]?.gst_rate || 0;
    doc.text('IGST', labelX, totY);
    doc.text(`${formatNumber(igstRate)}%`, labelX + 80, totY);
    doc.text(formatIndianNumber(invoice.igst_amount), valX, totY, { width: valW, align: 'right' });
    totY += 16;
    drawLine(totalColX, totY - 3, rightMargin, totY - 3);
  }

  // Round Off
  if (Math.abs(invoice.round_off) > 0.001) {
    doc.text('Round Off', labelX, totY);
    doc.text(formatIndianNumber(invoice.round_off), valX, totY, { width: valW, align: 'right' });
    totY += 16;
    drawLine(totalColX, totY - 3, rightMargin, totY - 3);
  }

  // Grand Total
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Grand Total', labelX, totY);
  doc.text(formatIndianNumber(invoice.grand_total), valX, totY, { width: valW, align: 'right' });

  currentY = bankTotalTop + bankSectionHeight;

  // ============================================================
  // GST AMOUNT IN WORDS + BILL AMOUNT IN WORDS
  // ============================================================
  const wordsRowHeight = 16;

  // Total GST in words
  drawRect(leftMargin, currentY, contentWidth, wordsRowHeight);
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text(`Total GST : ${numberToWords(invoice.total_gst)}`, leftMargin + 5, currentY + 4, {
    width: contentWidth - 10,
  });
  currentY += wordsRowHeight;

  // Bill Amount in words
  drawRect(leftMargin, currentY, contentWidth, wordsRowHeight);
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text(`Bill Amount : ${numberToWords(invoice.grand_total)}`, leftMargin + 5, currentY + 4, {
    width: contentWidth - 10,
  });
  currentY += wordsRowHeight;

  // ============================================================
  // TERMS & CONDITIONS + AUTHORIZED SIGNATORY
  // ============================================================
  const termsTop = currentY;
  const termsHeight = 810 - currentY; // Fill remaining space
  const sigWidth = 180;
  const termsWidth = contentWidth - sigWidth;

  drawRect(leftMargin, termsTop, termsWidth, termsHeight);
  drawRect(leftMargin + termsWidth, termsTop, sigWidth, termsHeight);

  // Terms & Conditions
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('Terms & Condition :', leftMargin + 5, termsTop + 5);

  if (companySettings.invoice_terms_and_conditions) {
    doc.font('Helvetica').fontSize(7);
    const terms = companySettings.invoice_terms_and_conditions.split('\n');
    let termY = termsTop + 16;
    terms.forEach((term, idx) => {
      const trimmed = term.trim();
      if (trimmed) {
        doc.text(`${idx + 1}. ${trimmed}`, leftMargin + 5, termY, { width: termsWidth - 15 });
        termY += 10;
      }
    });
  }

  // Authorized Signatory section
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text(`For, ${companySettings.company_name.toUpperCase()}`, leftMargin + termsWidth + 5, termsTop + 5, {
    width: sigWidth - 10,
  });

  doc.font('Helvetica-Oblique').fontSize(8);
  doc.text('(Authorised Signatory)', leftMargin + termsWidth + 5, termsTop + termsHeight - 15, {
    width: sigWidth - 10,
    align: 'right',
  });

  doc.end();
  return doc;
}
