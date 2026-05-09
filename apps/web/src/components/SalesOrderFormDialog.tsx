import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { salesOrderService, type SalesOrder } from '@/services/sales-order.service';
import { customerService } from '@/services/customer.service';
import type { CreateCustomerData } from '@/services/customer.service';
import { rawMaterialService } from '@/services/raw-material.service';
import { rmBatchService } from '@/services/rm-batch.service';
import { toast } from '@/hooks/use-toast';
import { CustomerFormDialog } from '@/components/CustomerFormDialog';

interface SalesOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrder?: SalesOrder;
  onSuccess: () => void;
}

interface LineItem {
  raw_material_id: string;
  batch_id: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
}

type SaleType = 'company' | 'individual';

export function SalesOrderFormDialog({
  open,
  onOpenChange,
  salesOrder,
  onSuccess,
}: SalesOrderFormDialogProps) {
  const isEdit = !!salesOrder;

  const [saleType, setSaleType] = useState<SaleType>('company');
  const [customer_id, setCustomerId] = useState('');
  const [order_date, setOrderDate] = useState('');
  const [expected_delivery_date, setExpectedDeliveryDate] = useState('');
  const [payment_method, setPaymentMethod] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { raw_material_id: '', batch_id: '', quantity: 0, unit_price: 0, gst_rate: 18 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [tempCustomerName, setTempCustomerName] = useState('');

  // Fetch customers filtered by sale type
  const { data: customersData, refetch: refetchCustomers } = useQuery({
    queryKey: ['customers', 'forSalesOrder', saleType],
    queryFn: () => customerService.getAll({ limit: 1000, customer_type: saleType }),
  });

  const { data: rawMaterialsData } = useQuery({
    queryKey: ['rawMaterials'],
    queryFn: () => rawMaterialService.getAll({ limit: 1000 }),
  });

  const { data: batchesData } = useQuery({
    queryKey: ['rmBatches'],
    queryFn: () => rmBatchService.getAll({ limit: 1000 }),
  });

  useEffect(() => {
    if (salesOrder) {
      setSaleType(salesOrder.sale_type === 'individual' ? 'individual' : 'company');
      setCustomerId(salesOrder.customer_id || '');
      setOrderDate(salesOrder.order_date.split('T')[0]);
      setExpectedDeliveryDate(salesOrder.expected_delivery_date?.split('T')[0] || '');
      setPaymentMethod(salesOrder.payment_method || undefined);
      setNotes(salesOrder.notes || '');
    } else {
      setSaleType('company');
      setCustomerId('');
      setOrderDate(new Date().toISOString().split('T')[0]);
      setExpectedDeliveryDate('');
      setPaymentMethod(undefined);
      setNotes('');
      setLineItems([{ raw_material_id: '', batch_id: '', quantity: 0, unit_price: 0, gst_rate: 18 }]);
    }
  }, [salesOrder, open]);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { raw_material_id: '', batch_id: '', quantity: 0, unit_price: 0, gst_rate: 18 },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Fixed: Use functional state update to avoid stale state issues
  const updateLineItem = (index: number, updates: Partial<LineItem>) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const calculateLineTotal = (item: LineItem) => {
    const amount = item.quantity * item.unit_price;
    const gst = amount * (item.gst_rate / 100);
    return amount + gst;
  };

  const calculateGrandTotal = () => {
    return lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const handleAddCustomer = (searchTerm: string) => {
    setTempCustomerName(searchTerm);
    setIsCustomerDialogOpen(true);
  };

  const handleCustomerFormSubmit = async (data: CreateCustomerData) => {
    try {
      const newCustomer = await customerService.create(data);
      await refetchCustomers();
      setCustomerId(newCustomer.id);
      setIsCustomerDialogOpen(false);
      toast({
        title: 'Customer created',
        description: 'Customer has been created successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create customer',
        variant: 'destructive',
      });
    }
  };

  const handleSaleTypeChange = (value: string) => {
    setSaleType(value as SaleType);
    setCustomerId(''); // Reset customer when switching type
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isEdit) {
        await salesOrderService.updateSalesOrder(salesOrder.id, {
          customer_id,
          sale_type: saleType,
          order_date,
          expected_delivery_date: expected_delivery_date || undefined,
          payment_method,
          notes,
        });
      } else {
        await salesOrderService.createSalesOrder({
          customer_id,
          sale_type: saleType,
          order_date,
          expected_delivery_date: expected_delivery_date || undefined,
          payment_method,
          items: lineItems,
          notes,
        });
      }
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to save sales order',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvailableBatches = (rawMaterialId: string) => {
    if (!batchesData) return [];
    return (batchesData.rm_batches || []).filter((b: any) => b.raw_material_id === rawMaterialId);
  };

  const customerOptions = (customersData?.customers || []).map((customer) => ({
    value: customer.id,
    label: customer.company_name + (customer.client_name ? ` (${customer.client_name})` : ''),
    metadata: customer.contact || customer.city || '',
  }));

  const productOptions = (rawMaterialsData?.raw_materials || []).map((rm: any) => ({
    value: rm.id,
    label: rm.name,
    metadata: rm.sku || '',
  }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Sales Order' : 'Create Sales Order'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update sales order details' : 'Create a new sales order for a customer or individual'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sale Type Radio Button */}
            <div className="space-y-2">
              <Label>Sale Type *</Label>
              <RadioGroup
                value={saleType}
                onValueChange={handleSaleTypeChange}
                className="flex gap-6"
                disabled={isEdit}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="company" id="sale-company" />
                  <Label htmlFor="sale-company" className="font-normal cursor-pointer">
                    Company Sale
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="sale-individual" />
                  <Label htmlFor="sale-individual" className="font-normal cursor-pointer">
                    Individual Sale
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Customer + Order Date - same layout for both types */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer">
                  {saleType === 'individual' ? 'Customer *' : 'Customer *'}
                </Label>
                <SearchableCombobox
                  options={customerOptions}
                  value={customer_id}
                  onChange={setCustomerId}
                  placeholder={saleType === 'individual' ? 'Select or add individual customer' : 'Select customer'}
                  allowAdd
                  onAddNew={handleAddCustomer}
                  label={saleType === 'individual' ? 'individual customer' : 'customer'}
                  required
                  disabled={isEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order_date">Order Date *</Label>
                <Input
                  id="order_date"
                  type="date"
                  value={order_date}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
              <Input
                id="expected_delivery_date"
                type="date"
                value={expected_delivery_date}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={payment_method || 'none'}
                onValueChange={(val) => setPaymentMethod(val === 'none' ? undefined : val)}
              >
                <SelectTrigger id="payment_method">
                  <SelectValue placeholder="None configured" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None configured</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CREDIT_CARD">Card</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isEdit && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Line Items *</Label>
                  <Button type="button" onClick={addLineItem} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Item {index + 1}</span>
                        {lineItems.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            variant="ghost"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>Product *</Label>
                          <SearchableCombobox
                            options={productOptions}
                            value={item.raw_material_id}
                            onChange={(value) => {
                              // Fixed: update both fields in a single call to avoid stale state
                              updateLineItem(index, { raw_material_id: value, batch_id: '' });
                            }}
                            placeholder="Select product"
                            label="product"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Batch *</Label>
                          <Select
                            value={item.batch_id}
                            onValueChange={(value) => updateLineItem(index, { batch_id: value })}
                            required
                            disabled={!item.raw_material_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select batch" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableBatches(item.raw_material_id).map((batch) => (
                                <SelectItem key={batch.id} value={batch.id}>
                                  {batch.batch_number} (Available: {batch.quantity_remaining})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Quantity *</Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={item.quantity || ''}
                            onChange={(e) =>
                              updateLineItem(index, { quantity: parseFloat(e.target.value) || 0 })
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>Unit Price *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_price || ''}
                            onChange={(e) =>
                              updateLineItem(index, { unit_price: parseFloat(e.target.value) || 0 })
                            }
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>GST Rate (%) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.gst_rate || ''}
                            onChange={(e) =>
                              updateLineItem(index, { gst_rate: parseFloat(e.target.value) || 0 })
                            }
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Total (incl. GST)</Label>
                          <Input
                            type="text"
                            value={new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: 'INR',
                            }).format(calculateLineTotal(item))}
                            readOnly
                            className="bg-gray-50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Grand Total</div>
                    <div className="text-2xl font-bold">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                      }).format(calculateGrandTotal())}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                {isSubmitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CustomerFormDialog
        open={isCustomerDialogOpen}
        onClose={() => setIsCustomerDialogOpen(false)}
        onSubmit={handleCustomerFormSubmit}
        isLoading={false}
        customerType={saleType}
        defaultName={tempCustomerName}
      />
    </>
  );
}
