import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, IndianRupee, AlertCircle, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { paymentService, type RecordPaymentData } from '@/services/payment.service';
import { invoiceService, type Invoice } from '@/services/invoice.service';
import { format } from 'date-fns';

export interface InvoiceForPayment {
  id: string;
  invoice_number: string;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  customer?: {
    company_name?: string;
    client_name?: string;
  };
}

interface RecordPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** If provided, skip invoice selection. If null, show invoice picker. */
  invoice?: InvoiceForPayment | null;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CREDIT_CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
] as const;

export function RecordPaymentDialog({ isOpen, onClose, invoice: invoiceProp }: RecordPaymentDialogProps) {
  const queryClient = useQueryClient();

  // For invoice selection mode (when no invoice is pre-selected)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceForPayment | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // The active invoice (either from prop or from selection)
  const invoice = invoiceProp !== undefined ? invoiceProp : selectedInvoice;
  const showInvoiceSelector = invoiceProp === undefined;

  // Fetch unpaid invoices for the picker
  const { data: unpaidInvoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices-unpaid'],
    queryFn: () => invoiceService.getInvoices({ limit: 100 }),
    enabled: isOpen && showInvoiceSelector,
  });

  const unpaidInvoices = (unpaidInvoicesData?.invoices || []).filter(
    (inv) => inv.amount_due > 0 && inv.status !== 'CANCELLED'
  );

  const filteredInvoices = invoiceSearch
    ? unpaidInvoices.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
          (inv.customer?.company_name || '').toLowerCase().includes(invoiceSearch.toLowerCase()) ||
          (inv.customer?.client_name || '').toLowerCase().includes(invoiceSearch.toLowerCase())
      )
    : unpaidInvoices;

  const [formData, setFormData] = useState({
    amount: '',
    payment_method: '' as string,
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    reference_number: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens with a new invoice
  useEffect(() => {
    if (isOpen) {
      // Use invoiceProp directly for amount to avoid stale selectedInvoice reference
      setFormData({
        amount: invoiceProp ? String(invoiceProp.amount_due) : '',
        payment_method: '',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        reference_number: '',
        notes: '',
      });
      setErrors({});
      if (!invoiceProp) {
        setSelectedInvoice(null);
        setInvoiceSearch('');
      }
    }
  }, [isOpen, invoiceProp?.id]);

  // Update amount when invoice changes (for picker mode)
  useEffect(() => {
    if (selectedInvoice) {
      setFormData((prev) => ({ ...prev, amount: String(selectedInvoice.amount_due) }));
    }
  }, [selectedInvoice?.id]);

  const recordPaymentMutation = useMutation({
    mutationFn: (data: RecordPaymentData) => paymentService.recordPayment(data),
    onSuccess: (result) => {
      toast({
        title: 'Payment recorded',
        description: `Payment of ₹${Number(formData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} recorded for ${invoice?.invoice_number}.`,
      });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-unpaid'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice?.id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      onClose();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to record payment';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || Number(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (invoice && Number(formData.amount) > invoice.amount_due) {
      newErrors.amount = `Amount cannot exceed outstanding amount (₹${invoice.amount_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`;
    }

    if (!formData.payment_method) {
      newErrors.payment_method = 'Please select a payment method';
    }

    if (!formData.payment_date) {
      newErrors.payment_date = 'Payment date is required';
    }

    // Reference number required for non-cash methods
    if (formData.payment_method && formData.payment_method !== 'CASH' && !formData.reference_number.trim()) {
      newErrors.reference_number = 'Reference number is required for this payment method';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!invoice) return;
    if (!validate()) return;

    recordPaymentMutation.mutate({
      invoice_id: invoice.id,
      payment_date: formData.payment_date,
      amount: Number(formData.amount),
      payment_method: formData.payment_method as RecordPaymentData['payment_method'],
      reference_number: formData.reference_number.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    });
  };

  const handleFullPayment = () => {
    if (invoice) {
      setFormData((prev) => ({ ...prev, amount: String(invoice.amount_due) }));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const customerName = invoice?.customer?.company_name || invoice?.customer?.client_name || 'N/A';
  const amountNum = Number(formData.amount) || 0;
  const remainingAfterPayment = invoice ? invoice.amount_due - amountNum : 0;

  const formatCurrencyInline = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Record Payment</DialogTitle>
          <DialogDescription>
            {invoice
              ? `Record a payment for invoice ${invoice.invoice_number}`
              : 'Select an invoice and record a payment'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Invoice Selector (when no invoice is pre-selected) */}
          {showInvoiceSelector && !invoice && (
            <div className="space-y-3">
              <Label>Select Invoice *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number or customer..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {loadingInvoices ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No unpaid invoices found
                </div>
              ) : (
                <div className="border rounded-lg max-h-60 overflow-y-auto divide-y">
                  {filteredInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors text-sm"
                      onClick={() => setSelectedInvoice({
                        id: inv.id,
                        invoice_number: inv.invoice_number,
                        grand_total: inv.grand_total,
                        amount_paid: inv.amount_paid,
                        amount_due: inv.amount_due,
                        customer: inv.customer,
                      })}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{inv.invoice_number}</span>
                          <span className="text-muted-foreground ml-2">
                            {inv.customer?.company_name || inv.customer?.client_name || 'N/A'}
                          </span>
                        </div>
                        <span className="font-medium text-orange-600">
                          {formatCurrencyInline(inv.amount_due)} due
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Show selected invoice change option in picker mode */}
          {showInvoiceSelector && invoice && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Invoice: <span className="font-medium text-foreground">{invoice.invoice_number}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setSelectedInvoice(null)}
              >
                Change
              </Button>
            </div>
          )}

          {invoice && (
            <>
            {/* Invoice Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-medium">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span>{customerName}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grand Total</span>
                <span>{formatCurrency(invoice.grand_total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="text-green-600">{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Amount Due</span>
                <span className="text-orange-600">{formatCurrency(invoice.amount_due)}</span>
              </div>
            </div>

            {/* Payment Form */}
            <div className="space-y-4">
              {/* Amount */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount">Payment Amount *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-teal-600 hover:text-teal-700"
                    onClick={handleFullPayment}
                  >
                    Pay Full Amount
                  </Button>
                </div>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={invoice.amount_due}
                    value={formData.amount}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, amount: e.target.value }));
                      setErrors((prev) => ({ ...prev, amount: '' }));
                    }}
                    className="pl-9"
                    placeholder="0.00"
                  />
                </div>
                {errors.amount && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.amount}
                  </p>
                )}
                {amountNum > 0 && amountNum < invoice.amount_due && (
                  <p className="text-xs text-muted-foreground">
                    Remaining after this payment: {formatCurrency(remainingAfterPayment)}
                  </p>
                )}
                {amountNum > 0 && amountNum === invoice.amount_due && (
                  <p className="text-xs text-green-600 font-medium">
                    This will fully settle the invoice
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method *</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, payment_method: value }));
                    setErrors((prev) => ({ ...prev, payment_method: '' }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.payment_method && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.payment_method}
                  </p>
                )}
              </div>

              {/* Payment Date */}
              <div className="space-y-2">
                <Label htmlFor="payment_date">Payment Date *</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, payment_date: e.target.value }));
                    setErrors((prev) => ({ ...prev, payment_date: '' }));
                  }}
                />
                {errors.payment_date && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.payment_date}
                  </p>
                )}
              </div>

              {/* Reference Number */}
              {formData.payment_method && formData.payment_method !== 'CASH' && (
                <div className="space-y-2">
                  <Label htmlFor="reference_number">
                    {formData.payment_method === 'UPI'
                      ? 'UPI Transaction ID *'
                      : formData.payment_method === 'BANK_TRANSFER'
                        ? 'Bank Transaction Reference *'
                        : formData.payment_method === 'CHEQUE'
                          ? 'Cheque Number *'
                          : 'Reference Number *'}
                  </Label>
                  <Input
                    id="reference_number"
                    value={formData.reference_number}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, reference_number: e.target.value }));
                      setErrors((prev) => ({ ...prev, reference_number: '' }));
                    }}
                    placeholder={
                      formData.payment_method === 'UPI'
                        ? 'Enter UPI transaction ID'
                        : formData.payment_method === 'BANK_TRANSFER'
                          ? 'Enter bank transaction reference'
                          : formData.payment_method === 'CHEQUE'
                            ? 'Enter cheque number'
                            : 'Enter reference number'
                    }
                  />
                  {errors.reference_number && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.reference_number}
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes about this payment..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={onClose} disabled={recordPaymentMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={recordPaymentMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {recordPaymentMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <IndianRupee className="mr-2 h-4 w-4" />
                    Record Payment
                  </>
                )}
              </Button>
            </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
