import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FileDown, Loader2, Package, CreditCard, Truck, FileText, IndianRupee, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { invoiceService, type Invoice } from '@/services/invoice.service';
import { RecordPaymentDialog } from '@/components/RecordPaymentDialog';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { paymentService } from '@/services/payment.service';
import { UpiQrDialog } from '@/components/UpiQrDialog';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface InvoiceViewDialogProps {
  invoiceId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InvoiceViewDialog({ invoiceId, isOpen, onClose }: InvoiceViewDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isUpiQrOpen, setIsUpiQrOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoiceService.getInvoiceById(invoiceId!),
    enabled: isOpen && !!invoiceId,
  });

  const invoice = data?.invoice;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    try {
      setDownloading(true);
      await invoiceService.downloadInvoicePDF(invoice.id, invoice.invoice_number);
      toast({
        title: 'Download started',
        description: `Invoice ${invoice.invoice_number} PDF is being downloaded.`,
      });
    } catch {
      toast({
        title: 'Download failed',
        description: 'Failed to download invoice PDF.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePayOnline = () => {
    if (!invoice) return;
    setIsUpiQrOpen(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pr-8">
            <div>
              <DialogTitle className="text-xl">
                Invoice {invoice?.invoice_number || ''}
              </DialogTitle>
              <DialogDescription>
                Invoice details and line items
              </DialogDescription>
            </div>
            {invoice && (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={invoice.status} />
                {invoice.amount_due > 0 && invoice.status !== 'CANCELLED' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                      onClick={handlePayOnline}
                    >
                      <Smartphone className="mr-2 h-4 w-4" />
                      UPI QR
                    </Button>
                    <Button
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700"
                      onClick={() => setIsPaymentDialogOpen(true)}
                    >
                      <IndianRupee className="mr-2 h-4 w-4" />
                      Record Offline Payment
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-2 h-4 w-4" />
                  )}
                  Download PDF
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="text-center py-12 text-destructive">
            Failed to load invoice details. Please try again.
          </div>
        )}

        {invoice && (
          <div className="space-y-6">
            {/* Invoice Info + Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Invoice Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Invoice Details
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice Number</span>
                    <span className="font-medium">{invoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice Date</span>
                    <span>{format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date</span>
                    <span>{format(new Date(invoice.due_date), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Place of Supply</span>
                    <span>{invoice.place_of_supply}</span>
                  </div>
                  {invoice.sales_order && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sales Order</span>
                      <span>{invoice.sales_order.so_number}</span>
                    </div>
                  )}
                  {invoice.delivery_note && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Note</span>
                      <span>{invoice.delivery_note.dn_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Customer Details
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Company</span>
                    <span className="font-medium">
                      {invoice.customer?.company_name || invoice.customer?.client_name || 'N/A'}
                    </span>
                  </div>
                  {invoice.customer?.client_name && invoice.customer?.company_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact</span>
                      <span>{invoice.customer.client_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Line Items
              </h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[40px]">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden sm:table-cell">HSN/SAC</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">GST %</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground">{item.sr_no}</TableCell>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="hidden sm:table-cell">{item.hsn_sac_code}</TableCell>
                          <TableCell className="text-right">
                            {Number(item.quantity).toFixed(3)} {item.unit}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                          <TableCell className="text-right hidden sm:table-cell">{Number(item.gst_rate).toFixed(2)}%</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">
                          No line items
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sub Total</span>
                  <span>{formatCurrency(invoice.sub_total)}</span>
                </div>
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-red-600">-{formatCurrency(invoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxable Amount</span>
                  <span>{formatCurrency(invoice.taxable_amount)}</span>
                </div>
                {invoice.cgst_amount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CGST</span>
                      <span>{formatCurrency(invoice.cgst_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SGST</span>
                      <span>{formatCurrency(invoice.sgst_amount)}</span>
                    </div>
                  </>
                )}
                {invoice.igst_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IGST</span>
                    <span>{formatCurrency(invoice.igst_amount)}</span>
                  </div>
                )}
                {invoice.round_off !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Round Off</span>
                    <span>{formatCurrency(invoice.round_off)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span>Grand Total</span>
                  <span>{formatCurrency(invoice.grand_total)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="text-green-600">{formatCurrency(invoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Amount Due</span>
                  <span className="text-orange-600">{formatCurrency(invoice.amount_due)}</span>
                </div>
              </div>
            </div>

            {/* Payments */}
            {invoice.payments && invoice.payments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Payments
                  </h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Payment #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="hidden sm:table-cell">Reference</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoice.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">{payment.payment_number}</TableCell>
                            <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy')}</TableCell>
                            <TableCell>{payment.payment_method}</TableCell>
                            <TableCell className="hidden sm:table-cell">{payment.reference_number || '-'}</TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {invoice.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Notes</h3>
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                    {invoice.notes}
                  </p>
                </div>
              </>
            )}

            {invoice.amount_due > 0 && invoice.status !== 'CANCELLED' && (
              <>
                <Separator />
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    onClick={handlePayOnline}
                  >
                    <Smartphone className="mr-2 h-4 w-4" />
                    UPI QR Code
                  </Button>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={() => setIsPaymentDialogOpen(true)}
                  >
                    <IndianRupee className="mr-2 h-4 w-4" />
                    Record Offline Payment
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>

      {/* Record Payment Dialog */}
      {invoice && (
        <RecordPaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => setIsPaymentDialogOpen(false)}
          invoice={{
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            grand_total: invoice.grand_total,
            amount_paid: invoice.amount_paid,
            amount_due: invoice.amount_due,
            customer: invoice.customer,
          }}
        />
      )}

      {/* UPI QR Dialog */}
      <UpiQrDialog
        isOpen={isUpiQrOpen}
        onClose={() => setIsUpiQrOpen(false)}
        invoiceId={invoice?.id || null}
        invoiceNumber={invoice?.invoice_number}
        amountDue={invoice?.amount_due}
      />
    </Dialog>
  );
}
