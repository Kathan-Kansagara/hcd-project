import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { deliveryNoteService, salesOrderService, type SalesOrder } from '@/services/sales-order.service';
import { toast } from '@/hooks/use-toast';

interface DeliveryNoteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrder: SalesOrder;
  onSuccess: () => void;
}

interface DeliveryItem {
  sales_order_item_id: string;
  product_name: string;
  ordered_quantity: number;
  quantity_delivered: number;
  unit: string;
}

export function DeliveryNoteFormDialog({
  open,
  onOpenChange,
  salesOrder,
  onSuccess,
}: DeliveryNoteFormDialogProps) {
  const [delivery_date, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch full SO details with items
  const { data: soData } = useQuery({
    queryKey: ['salesOrder', salesOrder.id],
    queryFn: () => salesOrderService.getSalesOrderById(salesOrder.id),
    enabled: open,
  });

  useEffect(() => {
    if (soData && open) {
      setDeliveryDate(new Date().toISOString().split('T')[0]);
      setNotes('');

      // Initialize delivery items with SO items
      const items = soData.salesOrder.items?.map((item) => ({
        sales_order_item_id: item.id,
        product_name: item.product_name,
        ordered_quantity: Number(item.quantity),
        quantity_delivered: Number(item.quantity),
        unit: item.unit,
      })) || [];

      setDeliveryItems(items);
    }
  }, [soData, open]);

  const updateDeliveryQuantity = (index: number, quantity: number) => {
    const updated = [...deliveryItems];
    updated[index].quantity_delivered = quantity;
    setDeliveryItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await deliveryNoteService.createDeliveryNote({
        sales_order_id: salesOrder.id,
        delivery_date,
        items: deliveryItems.map((item) => ({
          sales_order_item_id: item.sales_order_item_id,
          quantity_delivered: item.quantity_delivered,
        })),
        notes,
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create delivery note',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Delivery Note</DialogTitle>
          <DialogDescription>
            Create a delivery note for Sales Order {salesOrder.so_number}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Creating a delivery note will automatically reduce stock quantities and mark the sales
            order as DELIVERED.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Customer</div>
                <div className="font-medium">{soData?.salesOrder.customer_rel?.company_name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">SO Number</div>
                <div className="font-medium">{salesOrder.so_number}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_date">Delivery Date *</Label>
              <Input
                id="delivery_date"
                type="date"
                value={delivery_date}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Items to Deliver *</Label>
              {deliveryItems.map((item, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-sm text-gray-500">
                        Ordered: {item.ordered_quantity} {item.unit}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Quantity to Deliver ({item.unit})</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={item.quantity_delivered || ''}
                      onChange={(e) =>
                        updateDeliveryQuantity(index, parseFloat(e.target.value) || 0)
                      }
                      max={item.ordered_quantity}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Delivery Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Delivery notes, driver name, vehicle number, etc."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
              {isSubmitting ? 'Creating...' : 'Create Delivery Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
