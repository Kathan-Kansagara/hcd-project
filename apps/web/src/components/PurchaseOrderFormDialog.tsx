import { useState, useEffect } from 'react';
// Local type for combobox options
type ComboboxOption = { value: string; label: string; metadata?: string };

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { PurchaseOrder, CreatePurchaseOrderData } from '../services/purchase-order.service';
import { supplierService } from '../services/supplier.service';
import { rawMaterialService } from '../services/raw-material.service';
import { SupplierFormDialog } from './SupplierFormDialog';


interface PurchaseOrderFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePurchaseOrderData) => void;
  purchaseOrder?: PurchaseOrder | null;
  isLoading?: boolean;
}

interface LineItem {
  raw_material_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

const TEMP_NEW_SUPPLIER_PREFIX = 'temp-new-supplier-';

export function PurchaseOrderFormDialog({
  open,
  onClose,
  onSubmit,
  purchaseOrder,
  isLoading,
}: PurchaseOrderFormDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    supplier_id: '',
    order_date: new Date(),
    expected_delivery_date: undefined as Date | undefined,
    payment_method: undefined as string | undefined,
    notes: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { raw_material_id: '', quantity: 0, unit: 'LITER', unit_price: 0 },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [pendingSupplierName, setPendingSupplierName] = useState('');

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierService.getAll({ limit: 100 }),
  });

  const { data: rawMaterialsData } = useQuery({
    queryKey: ['raw-materials'],
    queryFn: () => rawMaterialService.getAll({ limit: 100 }),
  });

  const createSupplierMutation = useMutation({
    mutationFn: supplierService.create,
    onSuccess: (newSupplier) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setFormData((prev) => ({ ...prev, supplier_id: newSupplier.id }));
      setIsSupplierDialogOpen(false);
      setPendingSupplierName('');
      toast.success('Supplier created successfully');
    },
    onError: () => {
      toast.error('Failed to create supplier');
    },
  });

  useEffect(() => {
    if (purchaseOrder && open) {
      setFormData({
        supplier_id: purchaseOrder.supplier_id,
        order_date: new Date(purchaseOrder.order_date),
        expected_delivery_date: purchaseOrder.expected_delivery_date
          ? new Date(purchaseOrder.expected_delivery_date)
          : undefined,
        payment_method: purchaseOrder.payment_method || undefined,
        notes: purchaseOrder.notes || '',
      });

      if (purchaseOrder.items && purchaseOrder.items.length > 0) {
        setLineItems(
          purchaseOrder.items.map((item) => ({
            raw_material_id: item.raw_material_id,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
          }))
        );
      }
    } else if (open) {
      setFormData({
        supplier_id: '',
        order_date: new Date(),
        expected_delivery_date: undefined,
        payment_method: undefined,
        notes: '',
      });
      setLineItems([{ raw_material_id: '', quantity: 0, unit: 'LITER', unit_price: 0 }]);
    }
    setErrors({});
  }, [purchaseOrder, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.supplier_id || formData.supplier_id.startsWith(TEMP_NEW_SUPPLIER_PREFIX)) {
      newErrors.supplier_id = 'Please select or create a supplier';
    }

    if (!formData.order_date) {
      newErrors.order_date = 'Order date is required';
    }

    if (lineItems.length === 0) {
      newErrors.line_items = 'At least one line item is required';
    }

    lineItems.forEach((item, index) => {
      if (!item.raw_material_id) {
        newErrors[`line_item_${index}_raw_material`] = 'Raw material is required';
      }
      if (item.quantity <= 0) {
        newErrors[`line_item_${index}_quantity`] = 'Quantity must be greater than 0';
      }
      if (item.unit_price <= 0) {
        newErrors[`line_item_${index}_unit_price`] = 'Unit price must be greater than 0';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        supplier_id: formData.supplier_id,
        order_date: formData.order_date.toISOString().split('T')[0],
        expected_delivery_date: formData.expected_delivery_date
          ? formData.expected_delivery_date.toISOString().split('T')[0]
          : undefined,
        payment_method: formData.payment_method,
        notes: formData.notes,
        items: lineItems,
      });
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prevItems) => {
      const newLineItems = [...prevItems];
      newLineItems[index] = { ...newLineItems[index], [field]: value };
      return newLineItems;
    });

    const errorKey = `line_item_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { raw_material_id: '', quantity: 0, unit: 'LITER', unit_price: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const calculateLineTotal = (item: LineItem) => {
    return item.quantity * item.unit_price;
  };

  const calculateGrandTotal = () => {
    return lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const handleAddSupplier = (searchTerm: string) => {
    const tempId = `${TEMP_NEW_SUPPLIER_PREFIX}${Date.now()}`;
    setFormData((prev) => ({ ...prev, supplier_id: tempId }));
    setPendingSupplierName(searchTerm);
    setIsSupplierDialogOpen(true);
  };

  const handleSupplierDialogClose = () => {
    if (formData.supplier_id?.startsWith(TEMP_NEW_SUPPLIER_PREFIX)) {
      setFormData((prev) => ({ ...prev, supplier_id: '' }));
    }
    setIsSupplierDialogOpen(false);
    setPendingSupplierName('');
  };

  const handleSupplierDialogSubmit = (data: any) => {
    createSupplierMutation.mutate(data);
  };

  // Prepare supplier options
  const suppliers = suppliersData?.suppliers || [];
  const supplierOptions: ComboboxOption[] = suppliers.map((s) => ({
    value: s.id,
    label: s.company_name,
    metadata: s.contact_person || undefined,
  }));

  // Prepare raw material options
  const rawMaterials = rawMaterialsData?.raw_materials || [];
  const rawMaterialOptions: ComboboxOption[] = rawMaterials.map((rm) => ({
    value: rm.id,
    label: `${rm.code} - ${rm.name}`,
    metadata: rm.category,
  }));

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{purchaseOrder ? 'Edit Purchase Order' : 'Create Purchase Order'}</DialogTitle>
            <DialogDescription>
              {purchaseOrder ? 'Update purchase order details' : 'Create a new purchase order for raw materials'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="supplier_id">Supplier *</Label>
                <SearchableCombobox
                  options={supplierOptions}
                  value={formData.supplier_id.startsWith(TEMP_NEW_SUPPLIER_PREFIX) ? '' : formData.supplier_id}
                  onChange={(value) => handleChange('supplier_id', value)}
                  placeholder="Select or add supplier"
                  allowAdd
                  onAddNew={handleAddSupplier}
                  label="supplier"
                  required
                  className={errors.supplier_id ? 'border-red-500' : ''}
                />
                {errors.supplier_id && <p className="text-sm text-red-500 mt-1">{errors.supplier_id}</p>}
              </div>

              <div>
                <Label htmlFor="order_date">Order Date *</Label>
                <DatePickerField
                  value={formData.order_date}
                  onChange={(date) => handleChange('order_date', date)}
                  placeholder="Select order date"
                  required
                  className={errors.order_date ? 'border-red-500' : ''}
                />
                {errors.order_date && <p className="text-sm text-red-500 mt-1">{errors.order_date}</p>}
              </div>

              <div>
                <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
                <DatePickerField
                  value={formData.expected_delivery_date}
                  onChange={(date) => handleChange('expected_delivery_date', date)}
                  placeholder="Select expected delivery date"
                  minDate={formData.order_date}
                  showClear
                />
              </div>

              <div>
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select
                  value={formData.payment_method || 'none'}
                  onValueChange={(val) => handleChange('payment_method', val === 'none' ? undefined : val)}
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

              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={2}
                  placeholder="Additional notes or instructions"
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <Label className="text-base font-semibold">Line Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {errors.line_items && <p className="text-sm text-red-500 mb-2">{errors.line_items}</p>}

              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Item {index + 1}</h4>
                      {lineItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor={`raw_material_${index}`}>Raw Material *</Label>
                        <SearchableCombobox
                          options={rawMaterialOptions}
                          value={item.raw_material_id}
                          onChange={(value) => {
                            handleLineItemChange(index, 'raw_material_id', value);
                            // Auto-fill unit based on selected raw material
                            const selectedMaterial = rawMaterials.find((rm) => rm.id === value);
                            if (selectedMaterial?.unit) {
                              handleLineItemChange(index, 'unit', selectedMaterial.unit);
                            }
                          }}
                          placeholder="Select raw material"
                          label="raw material"
                          required
                          className={errors[`line_item_${index}_raw_material`] ? 'border-red-500' : ''}
                        />
                        {errors[`line_item_${index}_raw_material`] && (
                          <p className="text-sm text-red-500 mt-1">{errors[`line_item_${index}_raw_material`]}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`quantity_${index}`}>Quantity *</Label>
                        <Input
                          id={`quantity_${index}`}
                          type="number"
                          step="0.01"
                          value={item.quantity || ''}
                          onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className={errors[`line_item_${index}_quantity`] ? 'border-red-500' : ''}
                          placeholder="0.00"
                        />
                        {errors[`line_item_${index}_quantity`] && (
                          <p className="text-sm text-red-500 mt-1">{errors[`line_item_${index}_quantity`]}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`unit_${index}`}>Unit</Label>
                        <select
                          value={item.unit}
                          onChange={(e) => handleLineItemChange(index, 'unit', e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="LITER">LITER</option>
                          <option value="KG">KG</option>
                          <option value="PIECE">PIECE</option>
                        </select>
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor={`unit_price_${index}`}>Unit Price (₹) *</Label>
                        <Input
                          id={`unit_price_${index}`}
                          type="number"
                          step="0.01"
                          value={item.unit_price || ''}
                          onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          className={errors[`line_item_${index}_unit_price`] ? 'border-red-500' : ''}
                          placeholder="0.00"
                        />
                        {errors[`line_item_${index}_unit_price`] && (
                          <p className="text-sm text-red-500 mt-1">{errors[`line_item_${index}_unit_price`]}</p>
                        )}
                      </div>

                      <div className="col-span-2">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                          <span className="text-sm font-medium">Line Total:</span>
                          <span className="font-semibold">{formatCurrency(calculateLineTotal(item))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grand Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Grand Total:</span>
                <span className="text-2xl font-bold text-teal-600">{formatCurrency(calculateGrandTotal())}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-teal-600 hover:bg-teal-700">
                {isLoading ? 'Saving...' : purchaseOrder ? 'Update Purchase Order' : 'Create Purchase Order'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supplier Creation Dialog */}
      <SupplierFormDialog
        open={isSupplierDialogOpen}
        onClose={handleSupplierDialogClose}
        onSubmit={handleSupplierDialogSubmit}
        isLoading={createSupplierMutation.isPending}
        initialData={{ company_name: pendingSupplierName }}
      />
    </>
  );
}
