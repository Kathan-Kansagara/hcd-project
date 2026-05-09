import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, PackageCheck, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { purchaseOrderService } from '../services/purchase-order.service';
import type { PurchaseOrder, CreatePurchaseOrderData, POStatus } from '../services/purchase-order.service';
import { PurchaseOrderFormDialog } from '../components/PurchaseOrderFormDialog';
import { PurchaseOrderReceiveDialog } from '../components/PurchaseOrderReceiveDialog';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DataTableColumn, RowAction } from '@/components/ui/data-table';
import { PermissionGuard } from '@/components/PermissionGuard';

export default function PurchaseOrdersPage() {
  useBreadcrumbs([{ label: 'Purchase Orders' }]);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('order_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [cancellingPO, setCancellingPO] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page, search, sortBy, sortOrder],
    queryFn: () => purchaseOrderService.getAll({ page, limit: 10, search: search || undefined, sortBy, sortOrder }),
  });

  const createMutation = useMutation({
    mutationFn: purchaseOrderService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order created successfully');
      setIsFormOpen(false);
    },
    onError: () => {
      toast.error('Failed to create purchase order');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreatePurchaseOrderData }) =>
      purchaseOrderService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order updated successfully');
      setIsFormOpen(false);
      setEditingPO(null);
    },
    onError: () => {
      toast.error('Failed to update purchase order');
    },
  });

  const markReceivedMutation = useMutation({
    mutationFn: purchaseOrderService.markReceived,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order marked as received');
      setIsReceiveDialogOpen(false);
      setReceivingPO(null);
    },
    onError: () => {
      toast.error('Failed to mark purchase order as received');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: purchaseOrderService.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order cancelled successfully');
      setIsConfirmOpen(false);
      setCancellingPO(null);
    },
    onError: () => {
      toast.error('Failed to cancel purchase order');
      setIsConfirmOpen(false);
      setCancellingPO(null);
    },
  });

  const handleAddPO = () => {
    setEditingPO(null);
    setIsFormOpen(true);
  };

  const handleEditPO = async (id: string) => {
    try {
      // Always fetch fresh data from the backend for editing
      const po = await purchaseOrderService.getById(id);
      if (po) {
        setEditingPO(po);
        setIsFormOpen(true);
      }
    } catch {
      toast.error('Failed to load purchase order details');
    }
  };

  const handleReceivePO = (id: string) => {
    const po = data?.purchase_orders.find((p) => p.id === id);
    if (po) {
      setReceivingPO(po);
      setIsReceiveDialogOpen(true);
    }
  };

  const handleCancelPO = (id: string) => {
    const po = data?.purchase_orders.find((p) => p.id === id);
    if (po) {
      setCancellingPO(po);
      setIsConfirmOpen(true);
    }
  };

  const confirmCancel = () => {
    if (cancellingPO) {
      cancelMutation.mutate(cancellingPO.id);
    }
  };

  const handleFormSubmit = (data: CreatePurchaseOrderData) => {
    if (editingPO) {
      updateMutation.mutate({ id: editingPO.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingPO(null);
  };

  const handleReceiveConfirm = () => {
    if (receivingPO) {
      markReceivedMutation.mutate(receivingPO.id);
    }
  };

  const handleReceiveDialogClose = () => {
    setIsReceiveDialogOpen(false);
    setReceivingPO(null);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const exportToExcel = async () => {
    try {
      toast.info('Exporting purchase orders...');

      // Fetch all purchase orders (without pagination)
      const allData = await purchaseOrderService.getAll({ page: 1, limit: 10000 });
      const purchaseOrders = allData?.purchase_orders || [];

      if (!purchaseOrders || purchaseOrders.length === 0) {
        toast.error('No purchase orders to export');
        return;
      }

      // Create data for Excel
      const excelData = purchaseOrders.map((po) => ({
        'PO Number': po.po_number,
        'Supplier': po.supplier?.company_name || '-',
        'Order Date': formatDate(po.order_date),
        'Expected Delivery': po.expected_delivery_date ? formatDate(po.expected_delivery_date) : '-',
        'Status': po.status,
        'Payment Method': po.payment_method?.replace('_', ' ') || '-',
        'Total Amount': po.total_amount,
        'Notes': po.notes || '-',
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders');

      // Auto-size columns
      const maxWidth = excelData.reduce((w: any, r: any) => {
        return Object.keys(r).map((k, i) => Math.max(w[i] || 10, String(r[k]).length));
      }, []);
      ws['!cols'] = maxWidth.map((w: number) => ({ wch: w + 2 }));

      // Download
      XLSX.writeFile(wb, `purchase-orders-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success(`${purchaseOrders.length} purchase orders exported successfully`);
    } catch (error) {
      toast.error('Failed to export purchase orders');
    }
  };

  // Define DataTable columns
  const columns: DataTableColumn<PurchaseOrder>[] = [
    {
      header: 'PO Number',
      accessor: 'po_number',
      sortKey: 'po_number',
      cell: (row) => <span className="font-medium">{row.po_number}</span>,
    },
    {
      header: 'Supplier',
      accessor: (row) => row.supplier?.company_name || '-',
    },
    {
      header: 'Order Date',
      accessor: 'order_date',
      sortKey: 'order_date',
      cell: (row) => formatDate(row.order_date),
    },
    {
      header: 'Expected Delivery',
      accessor: 'expected_delivery_date',
      cell: (row) => (row.expected_delivery_date ? formatDate(row.expected_delivery_date) : '-'),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortKey: 'status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Payment Method',
      accessor: 'payment_method',
      cell: (row) => {
        if (!row.payment_method) return '-';
        const methodMap: Record<string, string> = {
          CASH: 'Cash',
          UPI: 'UPI',
          CREDIT_CARD: 'Card',
          BANK_TRANSFER: 'Bank Transfer',
          CHEQUE: 'Cheque',
          OTHER: 'Other',
        };
        return <span className="text-muted-foreground text-sm font-medium">{methodMap[row.payment_method] || row.payment_method}</span>;
      },
    },
    {
      header: 'Total Amount',
      accessor: 'total_amount',
      cell: (row) => formatCurrency(row.total_amount),
    },
    {
      header: 'Activity',
      accessor: 'created_at',
      sortKey: 'created_at',
      cell: (row: any) => (
        <div className="text-xs space-y-0.5">
          <div><span className="font-medium">{row.creator?.name || '-'}</span> <span className="text-muted-foreground">{row.created_at ? formatDate(row.created_at) : ''}</span></div>
          {row.updater && <div className="text-muted-foreground">edited by <span className="font-medium text-foreground">{row.updater.name}</span></div>}
        </div>
      ),
    },
  ];

  // Define row actions with conditional rendering
  // Note: Row actions are controlled by permissions via PermissionGuard in DataTable component
  const getRowActions = (po: PurchaseOrder): RowAction[] => {
    const actions: RowAction[] = [];
    const isAdmin = user?.role === 'ADMIN';

    if (po.status === 'PENDING') {
      actions.push({
        type: 'custom',
        label: 'Mark as Received',
        icon: PackageCheck,
        onClick: handleReceivePO,
      });
    }

    if (po.status === 'DRAFT' || po.status === 'PENDING') {
      actions.push({
        type: 'edit',
        label: 'Edit',
        onClick: handleEditPO,
      });
    }

    // ADMIN can cancel any order (including RECEIVED), others can only cancel PENDING/DRAFT
    if (po.status !== 'CANCELLED') {
      if (isAdmin || (po.status !== 'RECEIVED')) {
        actions.push({
          type: 'custom',
          label: 'Cancel',
          icon: XCircle,
          onClick: handleCancelPO,
          destructive: true,
        });
      }
    }

    return actions;
  };

  const purchaseOrders = data?.purchase_orders || [];

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        description="Manage raw material purchase orders"
        actions={
          <>
            <PermissionGuard permission="purchase-orders:view">
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="purchase-orders:manage">
              <Button onClick={handleAddPO}>
                <Plus className="mr-2 h-4 w-4" />
                Add Purchase Order
              </Button>
            </PermissionGuard>
          </>
        }
      />

      <DataTable
        title="All Purchase Orders"
        description={`${data?.pagination?.total || 0} total purchase orders`}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        columns={columns}
        data={purchaseOrders}
        rowId="id"
        rowActions={(row) => getRowActions(row)}
        pagination={
          data?.pagination
            ? {
                currentPage: page,
                totalPages: data.pagination.totalPages,
                total: data.pagination.total,
                limit: data.pagination.limit,
              }
            : undefined
        }
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No purchase orders found"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by PO number, supplier..."
        onPrimaryColumnClick={(id, row: any) => {
          if (row.status === 'DRAFT' || row.status === 'PENDING') {
            handleEditPO(id);
          }
        }}
      />

      <PurchaseOrderFormDialog
        open={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        purchaseOrder={editingPO}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <PurchaseOrderReceiveDialog
        open={isReceiveDialogOpen}
        onClose={handleReceiveDialogClose}
        onConfirm={handleReceiveConfirm}
        purchaseOrder={receivingPO}
        isLoading={markReceivedMutation.isPending}
      />

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setCancellingPO(null);
        }}
        onConfirm={confirmCancel}
        title="Cancel Purchase Order"
        message={`Are you sure you want to cancel purchase order ${cancellingPO?.po_number}? This action cannot be undone.`}
        confirmLabel="Cancel Order"
        cancelLabel="Keep Order"
        variant="destructive"
        loading={cancelMutation.isPending}
      />
    </>
  );
}
