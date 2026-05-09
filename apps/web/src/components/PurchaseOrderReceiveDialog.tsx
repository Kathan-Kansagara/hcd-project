import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PurchaseOrder } from '../services/purchase-order.service';

interface PurchaseOrderReceiveDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  purchaseOrder: PurchaseOrder | null;
  isLoading?: boolean;
}

export function PurchaseOrderReceiveDialog({
  open,
  onClose,
  onConfirm,
  purchaseOrder,
  isLoading,
}: PurchaseOrderReceiveDialogProps) {
  if (!purchaseOrder) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Purchase Order</DialogTitle>
          <DialogDescription>
            Confirm receipt of this purchase order. Stock will be updated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* PO Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">PO Number</p>
              <p className="font-semibold">{purchaseOrder.po_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Supplier</p>
              <p className="font-semibold">{purchaseOrder.supplier?.company_name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Order Date</p>
              <p className="font-semibold">{formatDate(purchaseOrder.order_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Expected Delivery</p>
              <p className="font-semibold">
                {purchaseOrder.expected_delivery_date ? formatDate(purchaseOrder.expected_delivery_date) : '-'}
              </p>
            </div>
            {purchaseOrder.notes && (
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Notes</p>
                <p className="font-semibold">{purchaseOrder.notes}</p>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div>
            <h3 className="font-semibold mb-3">Items to be Received</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Raw Material</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrder.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.raw_material?.name || '-'}
                        {item.raw_material?.category && (
                          <span className="text-sm text-gray-500 ml-2">({item.raw_material.category})</span>
                        )}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total_price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total Amount:</span>
              <span className="text-2xl font-bold text-teal-600">{formatCurrency(purchaseOrder.total_amount)}</span>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Marking this purchase order as received will:
            </p>
            <ul className="list-disc list-inside text-sm text-yellow-800 mt-2 space-y-1">
              <li>Create batches for all raw materials</li>
              <li>Update stock quantities automatically</li>
              <li>Calculate weighted average costs</li>
              <li>Record stock movements</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={isLoading} className="bg-teal-600 hover:bg-teal-700">
              {isLoading ? 'Processing...' : 'Confirm Receipt'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
