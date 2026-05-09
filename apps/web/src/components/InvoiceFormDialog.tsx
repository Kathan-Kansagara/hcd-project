import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { invoiceService, type Invoice, type CreateInvoiceData } from '@/services/invoice.service';
import { salesOrderService, deliveryNoteService, type SalesOrder, type DeliveryNote } from '@/services/sales-order.service';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type InvoiceSource = 'delivery_note' | 'sales_order';

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pass an invoice to edit; omit for create mode */
  invoice?: Invoice | null;
  /** Pre-select a sales order in create mode (e.g. from Sales Orders page) */
  preselectedSalesOrderId?: string | null;
}

export function InvoiceFormDialog({
  open,
  onOpenChange,
  onSuccess,
  invoice,
  preselectedSalesOrderId,
}: InvoiceFormDialogProps) {
  const isEdit = !!invoice;

  const [source, setSource] = useState<InvoiceSource>('sales_order');
  const [salesOrderId, setSalesOrderId] = useState('');
  const [deliveryNoteId, setDeliveryNoteId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch sales orders (only needed in create mode)
  const { data: salesOrdersData } = useQuery({
    queryKey: ['salesOrders-for-invoice'],
    queryFn: () => salesOrderService.getSalesOrders({ limit: 500 }),
    enabled: open && !isEdit,
  });

  // Fetch delivery notes (only needed in create mode)
  const { data: deliveryNotesData } = useQuery({
    queryKey: ['deliveryNotes-for-invoice'],
    queryFn: () => deliveryNoteService.getDeliveryNotes({ limit: 500 }),
    enabled: open && !isEdit,
  });

  // Prefill form when dialog opens
  useEffect(() => {
    if (!open) return;

    if (invoice) {
      // Edit mode: prefill from invoice
      setInvoiceDate(invoice.invoice_date ? invoice.invoice_date.split('T')[0] : '');
      setDueDate(invoice.due_date ? invoice.due_date.split('T')[0] : '');
      setDiscountAmount(invoice.discount_amount || 0);
      setDiscountPercentage(0);
      setNotes(invoice.notes || '');
      setPaymentTermsDays(30);
      // Source info (read-only in edit mode)
      if (invoice.delivery_note_id) {
        setSource('delivery_note');
        setDeliveryNoteId(invoice.delivery_note_id);
        setSalesOrderId('');
      } else {
        setSource('sales_order');
        setSalesOrderId(invoice.sales_order_id);
        setDeliveryNoteId('');
      }
    } else {
      // Create mode: reset (with optional preselected sales order)
      setSource('sales_order');
      setSalesOrderId(preselectedSalesOrderId || '');
      setDeliveryNoteId('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
      setPaymentTermsDays(30);
      setDiscountAmount(0);
      setDiscountPercentage(0);
      setNotes('');
    }
  }, [open, invoice, preselectedSalesOrderId]);

  const salesOrders: SalesOrder[] = salesOrdersData?.salesOrders || [];
  const deliveryNotes: DeliveryNote[] = deliveryNotesData?.deliveryNotes || [];

  // Filter to only show relevant sales orders (not cancelled)
  const availableSalesOrders = salesOrders.filter(
    (so) => so.status !== 'CANCELLED'
  );

  const salesOrderOptions = availableSalesOrders.map((so) => ({
    value: so.id,
    label: `${so.so_number}`,
    metadata: so.customer_rel?.company_name || so.customer_rel?.client_name || '',
  }));

  const deliveryNoteOptions = deliveryNotes.map((dn) => ({
    value: dn.id,
    label: `${dn.dn_number}`,
    metadata: dn.customer_rel?.company_name || dn.customer_rel?.client_name || '',
  }));

  // Get selected item details for preview (create mode only)
  const selectedSO = salesOrders.find((so) => so.id === salesOrderId);
  const selectedDN = deliveryNotes.find((dn) => dn.id === deliveryNoteId);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isEdit) {
        // --- Edit mode ---
        const updateData: Partial<CreateInvoiceData> & { status?: string } = {};

        if (invoiceDate) updateData.invoice_date = invoiceDate;
        if (dueDate) updateData.due_date = dueDate;
        if (discountAmount > 0) {
          updateData.discount_amount = discountAmount;
        } else if (discountPercentage > 0) {
          updateData.discount_percentage = discountPercentage;
        }
        updateData.notes = notes || undefined;

        await invoiceService.updateInvoice(invoice!.id, updateData);
        toast({
          title: 'Invoice updated',
          description: `Invoice ${invoice!.invoice_number} has been updated.`,
        });
      } else {
        // --- Create mode ---
        const data: any = {
          invoice_date: invoiceDate,
          payment_terms_days: paymentTermsDays,
          notes: notes || undefined,
        };

        if (dueDate) data.due_date = dueDate;
        if (discountAmount > 0) {
          data.discount_amount = discountAmount;
        } else if (discountPercentage > 0) {
          data.discount_percentage = discountPercentage;
        }

        if (source === 'delivery_note') {
          if (!deliveryNoteId) {
            toast({ title: 'Validation error', description: 'Please select a delivery note.', variant: 'destructive' });
            setIsSubmitting(false);
            return;
          }
          data.delivery_note_id = deliveryNoteId;
        } else {
          if (!salesOrderId) {
            toast({ title: 'Validation error', description: 'Please select a sales order.', variant: 'destructive' });
            setIsSubmitting(false);
            return;
          }
          data.sales_order_id = salesOrderId;
        }

        await invoiceService.createInvoice(data);
        toast({
          title: 'Invoice created',
          description: 'Invoice has been created successfully.',
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: isEdit ? 'Error updating invoice' : 'Error creating invoice',
        description: error.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} invoice.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Invoice' : 'Create Invoice'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update details for invoice ${invoice!.invoice_number}`
              : 'Generate an invoice from a sales order or delivery note. Items and amounts will be calculated automatically.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Edit mode: show invoice summary ── */}
          {isEdit && invoice && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div><span className="font-medium">Invoice:</span> {invoice.invoice_number}</div>
              <div><span className="font-medium">Customer:</span> {invoice.customer?.company_name || invoice.customer?.client_name || 'N/A'}</div>
              <div><span className="font-medium">Amount:</span> {formatCurrency(invoice.grand_total)}</div>
              <div><span className="font-medium">Status:</span> {invoice.status}</div>
              {invoice.sales_order && (
                <div><span className="font-medium">Sales Order:</span> {invoice.sales_order.so_number}</div>
              )}
              {invoice.delivery_note && (
                <div><span className="font-medium">Delivery Note:</span> {invoice.delivery_note.dn_number}</div>
              )}
            </div>
          )}

          {/* ── Create mode: source selection ── */}
          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label>Create from *</Label>
                <Select
                  value={source}
                  onValueChange={(val) => {
                    setSource(val as InvoiceSource);
                    setSalesOrderId('');
                    setDeliveryNoteId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_order">Sales Order</SelectItem>
                    <SelectItem value="delivery_note">Delivery Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {source === 'sales_order' ? (
                <div className="space-y-2">
                  <Label>Sales Order *</Label>
                  <SearchableCombobox
                    options={salesOrderOptions}
                    value={salesOrderId}
                    onChange={setSalesOrderId}
                    placeholder="Search sales order..."
                    label="sales order"
                    required
                  />
                  {selectedSO && (
                    <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                      <div><span className="font-medium">Customer:</span> {selectedSO.customer_rel?.company_name || selectedSO.customer_rel?.client_name || 'N/A'}</div>
                      <div><span className="font-medium">Status:</span> {selectedSO.status}</div>
                      {selectedSO.grand_total !== undefined && (
                        <div><span className="font-medium">Order Total:</span> {formatCurrency(selectedSO.grand_total)}</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Delivery Note *</Label>
                  <SearchableCombobox
                    options={deliveryNoteOptions}
                    value={deliveryNoteId}
                    onChange={setDeliveryNoteId}
                    placeholder="Search delivery note..."
                    label="delivery note"
                    required
                  />
                  {selectedDN && (
                    <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                      <div><span className="font-medium">Customer:</span> {selectedDN.customer_rel?.company_name || selectedDN.customer_rel?.client_name || 'N/A'}</div>
                      <div><span className="font-medium">Sales Order:</span> {selectedDN.sales_order?.so_number || 'N/A'}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Shared fields: dates, discount, notes ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice Date *</Label>
              <Input
                id="invoice_date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {!isEdit && !dueDate && (
                <p className="text-xs text-muted-foreground">
                  Auto-calculated: {paymentTermsDays} days from invoice date
                </p>
              )}
            </div>
          </div>

          {/* Payment Terms (create mode only, when no due date) */}
          {!isEdit && !dueDate && (
            <div className="space-y-2">
              <Label htmlFor="payment_terms_days">Payment Terms (days)</Label>
              <Input
                id="payment_terms_days"
                type="number"
                min={0}
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(parseInt(e.target.value) || 0)}
              />
            </div>
          )}

          {/* Discount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount_amount">Discount Amount (₹)</Label>
              <Input
                id="discount_amount"
                type="number"
                step="0.01"
                min={0}
                value={discountAmount || ''}
                onChange={(e) => {
                  setDiscountAmount(parseFloat(e.target.value) || 0);
                  if (parseFloat(e.target.value) > 0) setDiscountPercentage(0);
                }}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount_percentage">Discount (%)</Label>
              <Input
                id="discount_percentage"
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={discountPercentage || ''}
                onChange={(e) => {
                  setDiscountPercentage(parseFloat(e.target.value) || 0);
                  if (parseFloat(e.target.value) > 0) setDiscountAmount(0);
                }}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="invoice_notes">Notes</Label>
            <Textarea
              id="invoice_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the invoice..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
              {isSubmitting
                ? (isEdit ? 'Updating...' : 'Creating...')
                : (isEdit ? 'Update Invoice' : 'Create Invoice')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
