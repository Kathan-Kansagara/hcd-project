import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  Loader2,
  IndianRupee,
  AlertCircle,
  ScanBarcode,
  CheckCircle2,
  XCircle,
  Globe,
  ArrowLeft,
  Banknote,
  Smartphone,
  Building2,
  FileCheck,
  CreditCard,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { invoiceService, type Invoice } from '@/services/invoice.service';
import { paymentService, type RecordPaymentData } from '@/services/payment.service';
import { UpiQrDialog } from '@/components/UpiQrDialog';
import { format } from 'date-fns';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

type DialogStep = 'scan' | 'invoice-found' | 'payment-form' | 'processing' | 'success' | 'error';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote, color: 'bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20' },
  { value: 'UPI', label: 'UPI', icon: Smartphone, color: 'bg-orange-500/10 text-orange-600 border-orange-200 hover:bg-orange-500/20' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Building2, color: 'bg-purple-500/10 text-purple-600 border-purple-200 hover:bg-purple-500/20' },
  { value: 'CHEQUE', label: 'Cheque', icon: FileCheck, color: 'bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20' },
  { value: 'CREDIT_CARD', label: 'Card', icon: CreditCard, color: 'bg-pink-500/10 text-pink-600 border-pink-200 hover:bg-pink-500/20' },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal, color: 'bg-gray-500/10 text-gray-600 border-gray-200 hover:bg-gray-500/20' },
] as const;

interface ScanPayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** If a barcode was scanned externally (e.g., global hook), pass it here */
  initialBarcode?: string | null;
}

export function ScanPayDialog({ isOpen, onClose, initialBarcode }: ScanPayDialogProps) {
  const queryClient = useQueryClient();
  const manualInputRef = useRef<HTMLInputElement>(null);

  // State machine
  const [step, setStep] = useState<DialogStep>('scan');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [scannedCode, setScannedCode] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Payment form state
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [formData, setFormData] = useState({
    amount: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    reference_number: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // UPI QR dialog state
  const [isUpiQrOpen, setIsUpiQrOpen] = useState(false);

  // Reset everything when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('scan');
      setInvoice(null);
      setScannedCode('');
      setManualInput('');
      setIsLookingUp(false);
      setErrorMessage('');
      setSelectedMethod('');
      setFormData({
        amount: '',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        reference_number: '',
        notes: '',
      });
      setErrors({});

      // If opened with a barcode, look it up immediately
      if (initialBarcode) {
        lookupInvoice(initialBarcode);
      }
    }
  }, [isOpen]);

  // Handle initialBarcode changes while dialog is open
  useEffect(() => {
    if (isOpen && initialBarcode && step === 'scan') {
      lookupInvoice(initialBarcode);
    }
  }, [initialBarcode]);

  // Focus manual input when in scan step
  useEffect(() => {
    if (step === 'scan' && manualInputRef.current) {
      setTimeout(() => manualInputRef.current?.focus(), 100);
    }
  }, [step]);

  const lookupInvoice = async (invoiceNumber: string) => {
    setIsLookingUp(true);
    setScannedCode(invoiceNumber);
    setErrorMessage('');

    try {
      const { invoice: found } = await invoiceService.getInvoiceByNumber(invoiceNumber);

      if (found.amount_due <= 0) {
        setErrorMessage('This invoice is already fully paid.');
        setStep('error');
        return;
      }

      if (found.status === 'CANCELLED') {
        setErrorMessage('This invoice has been cancelled.');
        setStep('error');
        return;
      }

      setInvoice(found);
      setFormData((prev) => ({ ...prev, amount: String(found.amount_due) }));
      setStep('invoice-found');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Invoice not found. Please check the barcode/number.';
      setErrorMessage(msg);
      setStep('error');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleManualLookup = () => {
    const trimmed = manualInput.trim();
    if (trimmed.length < 3) {
      toast({ title: 'Invalid', description: 'Please enter a valid invoice number', variant: 'destructive' });
      return;
    }
    lookupInvoice(trimmed);
  };

  // Payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: (data: RecordPaymentData) => paymentService.recordPayment(data),
    onSuccess: () => {
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-unpaid'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice?.id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to record payment';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || Number(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (invoice && Number(formData.amount) > invoice.amount_due) {
      newErrors.amount = `Amount cannot exceed ₹${invoice.amount_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }

    if (!formData.payment_date) {
      newErrors.payment_date = 'Payment date is required';
    }

    if (selectedMethod && selectedMethod !== 'CASH' && !formData.reference_number.trim()) {
      newErrors.reference_number = 'Reference number is required for this method';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitPayment = () => {
    if (!invoice || !selectedMethod) return;
    if (!validate()) return;

    recordPaymentMutation.mutate({
      invoice_id: invoice.id,
      payment_date: formData.payment_date,
      amount: Number(formData.amount),
      payment_method: selectedMethod as RecordPaymentData['payment_method'],
      reference_number: formData.reference_number.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    });
  };

  const handlePayOnline = () => {
    if (!invoice) return;
    setIsUpiQrOpen(true);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  const customerName = invoice?.customer?.company_name || invoice?.customer?.client_name || 'N/A';
  const amountNum = Number(formData.amount) || 0;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* ────────── STEP: SCAN ────────── */}
        {step === 'scan' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <div className="p-2 rounded-lg bg-teal-500/10">
                  <ScanBarcode className="h-5 w-5 text-teal-600" />
                </div>
                Scan & Pay
              </DialogTitle>
              <DialogDescription>
                Scan an invoice barcode or enter the invoice number to make a payment
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Scanner animation */}
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative">
                  <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-teal-300 flex items-center justify-center bg-teal-50/50">
                    <ScanBarcode className="h-12 w-12 text-teal-500 animate-pulse" />
                  </div>
                  {/* Scanning line animation */}
                  <div className="absolute left-2 right-2 top-4 h-0.5 bg-gradient-to-r from-transparent via-teal-500 to-transparent animate-bounce" />
                </div>
                {isLookingUp ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Looking up invoice...
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground text-center">
                    Point your barcode scanner at the invoice barcode
                  </p>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or enter manually</span>
                </div>
              </div>

              {/* Manual input */}
              <div className="flex gap-2">
                <Input
                  ref={manualInputRef}
                  placeholder="e.g., INV-2026-001"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualLookup();
                    }
                  }}
                  data-barcode-input="true"
                  className="flex-1"
                />
                <Button
                  onClick={handleManualLookup}
                  disabled={isLookingUp || !manualInput.trim()}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lookup'}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ────────── STEP: INVOICE FOUND ────────── */}
        {step === 'invoice-found' && invoice && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <div className="p-2 rounded-lg bg-teal-500/10">
                  <CheckCircle2 className="h-5 w-5 text-teal-600" />
                </div>
                Invoice Found
              </DialogTitle>
              <DialogDescription>
                Select a payment method for invoice {invoice.invoice_number}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {/* Invoice summary card */}
              <div className="bg-gradient-to-br from-slate-50 to-teal-50/30 rounded-xl p-4 border border-teal-100 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-teal-700">{invoice.invoice_number}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
                    {invoice.status}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{customerName}</span>
                </div>
                <Separator className="bg-teal-100" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Grand Total</span>
                  <span>{formatCurrency(invoice.grand_total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Already Paid</span>
                  <span className="text-green-600">{formatCurrency(invoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base">
                  <span>Amount Due</span>
                  <span className="text-orange-600">{formatCurrency(invoice.amount_due)}</span>
                </div>
              </div>

              {/* Payment method grid */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Choose Payment Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const isSelected = selectedMethod === method.value;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => {
                          setSelectedMethod(method.value);
                          setStep('payment-form');
                        }}
                        className={`
                          flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200
                          ${isSelected ? 'ring-2 ring-teal-500 border-teal-500' : `border ${method.color}`}
                          hover:scale-[1.02] active:scale-[0.98]
                        `}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-medium">{method.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Pay Online button */}
                <Button
                  variant="outline"
                  className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 h-11"
                  onClick={handlePayOnline}
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  Show UPI QR Code
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('scan');
                  setInvoice(null);
                  setManualInput('');
                }}
                className="text-xs text-muted-foreground"
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                Scan another invoice
              </Button>
            </div>
          </>
        )}

        {/* ────────── STEP: PAYMENT FORM ────────── */}
        {step === 'payment-form' && invoice && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <div className="p-2 rounded-lg bg-teal-500/10">
                  {(() => {
                    const method = PAYMENT_METHODS.find((m) => m.value === selectedMethod);
                    const Icon = method?.icon || IndianRupee;
                    return <Icon className="h-5 w-5 text-teal-600" />;
                  })()}
                </div>
                {PAYMENT_METHODS.find((m) => m.value === selectedMethod)?.label} Payment
              </DialogTitle>
              <DialogDescription>
                {invoice.invoice_number} — {customerName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Compact invoice summary */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Amount Due</span>
                <span className="font-semibold text-orange-600">{formatCurrency(invoice.amount_due)}</span>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="scan-amount">Payment Amount *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-teal-600 hover:text-teal-700"
                    onClick={() => setFormData((prev) => ({ ...prev, amount: String(invoice.amount_due) }))}
                  >
                    Pay Full Amount
                  </Button>
                </div>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="scan-amount"
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
                    Remaining after payment: {formatCurrency(invoice.amount_due - amountNum)}
                  </p>
                )}
                {amountNum > 0 && amountNum === invoice.amount_due && (
                  <p className="text-xs text-green-600 font-medium">
                    ✓ This will fully settle the invoice
                  </p>
                )}
              </div>

              {/* Payment Date */}
              <div className="space-y-2">
                <Label htmlFor="scan-date">Payment Date *</Label>
                <Input
                  id="scan-date"
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

              {/* Reference Number (for non-cash methods) */}
              {selectedMethod && selectedMethod !== 'CASH' && (
                <div className="space-y-2">
                  <Label htmlFor="scan-ref">
                    {selectedMethod === 'UPI'
                      ? 'UPI Transaction ID *'
                      : selectedMethod === 'BANK_TRANSFER'
                        ? 'Bank Transaction Ref *'
                        : selectedMethod === 'CHEQUE'
                          ? 'Cheque Number *'
                          : 'Reference Number *'}
                  </Label>
                  <Input
                    id="scan-ref"
                    value={formData.reference_number}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, reference_number: e.target.value }));
                      setErrors((prev) => ({ ...prev, reference_number: '' }));
                    }}
                    placeholder={
                      selectedMethod === 'UPI'
                        ? 'Enter UPI transaction ID'
                        : selectedMethod === 'BANK_TRANSFER'
                          ? 'Enter bank transaction reference'
                          : selectedMethod === 'CHEQUE'
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
                <Label htmlFor="scan-notes">Notes (optional)</Label>
                <Textarea
                  id="scan-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('invoice-found');
                  setSelectedMethod('');
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleSubmitPayment}
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

        {/* ────────── STEP: PROCESSING ────────── */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="p-4 rounded-full bg-teal-50">
              <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Processing payment...</p>
          </div>
        )}

        {/* ────────── STEP: SUCCESS ────────── */}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="p-4 rounded-full bg-green-50 ring-4 ring-green-100">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-green-700">Payment Recorded!</h3>
              <p className="text-sm text-muted-foreground">
                {invoice && (
                  <>
                    {formatCurrency(amountNum)} paid for {invoice.invoice_number}
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => {
                  setStep('scan');
                  setInvoice(null);
                  setManualInput('');
                  setScannedCode('');
                  setSelectedMethod('');
                  setFormData({
                    amount: '',
                    payment_date: format(new Date(), 'yyyy-MM-dd'),
                    reference_number: '',
                    notes: '',
                  });
                }}
              >
                <ScanBarcode className="mr-2 h-4 w-4" />
                Scan Next
              </Button>
            </div>
          </div>
        )}

        {/* ────────── STEP: ERROR ────────── */}
        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="p-4 rounded-full bg-red-50 ring-4 ring-red-100">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-red-700">Not Found</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {errorMessage}
              </p>
              {scannedCode && (
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  Scanned: {scannedCode}
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => {
                  setStep('scan');
                  setManualInput('');
                  setScannedCode('');
                  setErrorMessage('');
                }}
              >
                <ScanBarcode className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* UPI QR Code Dialog */}
    <UpiQrDialog
      isOpen={isUpiQrOpen}
      onClose={() => setIsUpiQrOpen(false)}
      invoiceId={invoice?.id || null}
      invoiceNumber={invoice?.invoice_number}
      amountDue={invoice?.amount_due}
    />
    </>
  );
}
