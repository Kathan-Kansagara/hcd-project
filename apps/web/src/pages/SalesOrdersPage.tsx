import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, FileText, PackageCheck, XCircle, Receipt, CheckCircle2, User, Building2, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { salesOrderService, type SalesOrder } from '@/services/sales-order.service';
import { SalesOrderFormDialog } from '@/components/SalesOrderFormDialog';
import { DeliveryNoteFormDialog } from '@/components/DeliveryNoteFormDialog';
import { InvoiceFormDialog } from '@/components/InvoiceFormDialog';
import { InvoiceViewDialog } from '@/components/InvoiceViewDialog';
import { toast } from '@/hooks/use-toast';
import { PermissionGuard } from '@/components/PermissionGuard';
import type { DataTableColumn, RowAction } from '@/components/ui/data-table';

export default function SalesOrdersPage() {
  useBreadcrumbs([{ label: 'Sales Orders' }]);
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDNOpen, setIsDNOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceSalesOrderId, setInvoiceSalesOrderId] = useState<string | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [isViewInvoiceOpen, setIsViewInvoiceOpen] = useState(false);
  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('order_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 20;

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['salesOrders', page, search, sortBy, sortOrder],
    queryFn: () => salesOrderService.getSalesOrders({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    refetch();
    toast({
      title: 'Sales order created',
      description: 'Sales order has been created successfully.',
    });
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    setSelectedSO(null);
    refetch();
    toast({
      title: 'Sales order updated',
      description: 'Sales order has been updated successfully.',
    });
  };

  const handleDNSuccess = () => {
    setIsDNOpen(false);
    setSelectedSO(null);
    refetch();
    toast({
      title: 'Delivery note created',
      description: 'Delivery note has been created successfully.',
    });
  };

  const handleCancel = async (so: SalesOrder) => {
    try {
      await salesOrderService.cancelSalesOrder(so.id);
      refetch();
      toast({
        title: 'Sales order cancelled',
        description: `SO ${so.so_number} has been cancelled.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to cancel sales order',
        variant: 'destructive',
      });
    }
  };

  const handleMarkDelivered = async (so: SalesOrder) => {
    try {
      await salesOrderService.markDelivered(so.id);
      refetch();
      toast({
        title: 'Sales order delivered',
        description: `SO ${so.so_number} has been marked as delivered. Stock has been deducted.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to mark as delivered',
        variant: 'destructive',
      });
    }
  };

  const handleExportExcel = useCallback(() => {
    if (!data?.salesOrders || data.salesOrders.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no sales orders to export.',
        variant: 'destructive',
      });
      return;
    }

    const exportData = data.salesOrders.map((so) => ({
      'SO Number': so.so_number,
      'Sale Type': so.sale_type === 'individual' ? 'Individual' : 'Company',
      'Customer': so.customer_rel?.company_name || 'N/A',
      'Order Date': new Date(so.order_date).toLocaleDateString('en-IN'),
      'Status': so.status,
      'Payment Method': so.payment_method?.replace('_', ' ') || '-',
      'Items': so.items?.length || 0,
      'Sub Total': so.sub_total || 0,
      'GST': so.total_gst || 0,
      'Grand Total': so.grand_total || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Orders');

    const maxWidth = 20;
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.min(
        Math.max(
          key.length,
          ...exportData.map((row) => String(row[key as keyof typeof row]).length)
        ),
        maxWidth
      ),
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `sales-orders-${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: 'Export successful',
      description: `Exported ${data.salesOrders.length} sales orders to Excel.`,
    });
  }, [data]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const salesOrders = data?.salesOrders || [];

  const columns: DataTableColumn[] = [
    { header: 'SO Number', accessor: 'so_number', sortKey: 'so_number', cellClassName: 'font-medium' },
    {
      header: 'Type',
      accessor: 'sale_type',
      cell: (row: any) => (
        <div className="flex items-center gap-1.5">
          {row.sale_type === 'individual' ? (
            <>
              <User className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-blue-600">Individual</span>
            </>
          ) : (
            <>
              <Building2 className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs font-medium text-purple-600">Company</span>
            </>
          )}
        </div>
      ),
    },
    {
      header: 'Customer / Buyer',
      accessor: 'customer_rel',
      cell: (row: any) => {
        if (!row.customer_rel) return 'N/A';
        return (
          <div>
            <div className="font-medium">{row.customer_rel.company_name}</div>
            {row.customer_rel.contact && (
              <div className="text-xs text-muted-foreground">{row.customer_rel.contact}</div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Order Date',
      accessor: 'order_date',
      sortKey: 'order_date',
      cell: (row: any) => new Date(row.order_date).toLocaleDateString('en-IN'),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortKey: 'status',
      cell: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Payment Method',
      accessor: 'payment_method',
      cell: (row: any) => {
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
      header: 'Items',
      accessor: 'items',
      cell: (row: any) => row.items?.length || 0,
    },
    {
      header: 'Total',
      accessor: 'grand_total',
      cell: (row: any) => formatCurrency(row.grand_total || 0),
      cellClassName: 'font-semibold',
    },
    {
      header: 'Activity',
      accessor: 'created_at',
      sortKey: 'created_at',
      cell: (row: any) => (
        <div className="text-xs space-y-0.5">
          <div><span className="font-medium">{row.creator?.name || '-'}</span> <span className="text-muted-foreground">{row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : ''}</span></div>
          {row.updater && <div className="text-muted-foreground">edited by <span className="font-medium text-foreground">{row.updater.name}</span></div>}
        </div>
      ),
    },
  ];

  const getRowActions = (row: any): RowAction[] => {
    const isEditable = row.status !== 'DELIVERED' && row.status !== 'CANCELLED';
    const actions: RowAction[] = [];

    if (isEditable) {
      actions.push({
        type: 'edit',
        label: 'Edit',
        icon: FileText,
        onClick: async (id: string) => {
          try {
            // Always fetch fresh data from the backend for editing
            const { salesOrder } = await salesOrderService.getSalesOrderById(id);
            if (salesOrder) {
              setSelectedSO(salesOrder);
              setIsEditOpen(true);
            }
          } catch {
            toast({ title: 'Error', description: 'Failed to load sales order details', variant: 'destructive' });
          }
        },
      });

      // Mark as Delivered (direct delivery without delivery note)
      actions.push({
        type: 'custom',
        label: 'Mark Delivered',
        icon: CheckCircle2,
        onClick: (id: string) => {
          const so = salesOrders.find((s: any) => s.id === id);
          if (so) handleMarkDelivered(so);
        },
      });

      // Create Delivery Note
      actions.push({
        type: 'custom',
        label: 'Create Delivery Note',
        icon: PackageCheck,
        onClick: (id: string) => {
          const so = salesOrders.find((s: any) => s.id === id);
          if (so) {
            setSelectedSO(so);
            setIsDNOpen(true);
          }
        },
      });
    }

    // Invoice action: View Invoice if one exists, otherwise Generate Invoice
    if (row.status !== 'CANCELLED') {
      const existingInvoice = row.invoices && row.invoices.length > 0 ? row.invoices[0] : null;
      if (existingInvoice) {
        actions.push({
          type: 'custom',
          label: 'View Invoice',
          icon: Eye,
          onClick: () => {
            setViewInvoiceId(existingInvoice.id);
            setIsViewInvoiceOpen(true);
          },
        });
      } else {
        actions.push({
          type: 'custom',
          label: 'Generate Invoice',
          icon: Receipt,
          onClick: (id: string) => {
            setInvoiceSalesOrderId(id);
            setIsInvoiceOpen(true);
          },
        });
      }
    }

    if (isEditable) {
      actions.push({
        type: 'custom',
        label: 'Cancel',
        icon: XCircle,
        destructive: true,
        onClick: (id: string) => {
          const so = salesOrders.find((s: any) => s.id === id);
          if (so) handleCancel(so);
        },
      });
    }

    return actions;
  };

  return (
    <>
      <PageHeader
        title="Sales Orders"
        description="Manage customer sales orders and deliveries"
        actions={
          <>
            <PermissionGuard permission="sales-orders:view">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleExportExcel}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="sales-orders:manage">
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Sales Order
              </Button>
            </PermissionGuard>
          </>
        }
      />

      <DataTable
        title="All Sales Orders"
        description={`${data?.pagination?.total || 0} total sales orders`}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        columns={columns}
        data={salesOrders}
        rowId="id"
        rowActions={getRowActions}
        pagination={data?.pagination}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No sales orders found"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by SO number, customer..."
        onPrimaryColumnClick={(id, row: any) => {
          if (row.status !== 'DELIVERED' && row.status !== 'CANCELLED') {
            const so = salesOrders.find((s: any) => s.id === id);
            if (so) {
              setSelectedSO(so);
              setIsEditOpen(true);
            }
          }
        }}
      />

      <SalesOrderFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={handleCreateSuccess}
      />

      {selectedSO && (
        <>
          <SalesOrderFormDialog
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
            salesOrder={selectedSO}
            onSuccess={handleEditSuccess}
          />
          <DeliveryNoteFormDialog
            open={isDNOpen}
            onOpenChange={setIsDNOpen}
            salesOrder={selectedSO}
            onSuccess={handleDNSuccess}
          />
        </>
      )}

      {/* Generate Invoice Dialog */}
      <InvoiceFormDialog
        open={isInvoiceOpen}
        onOpenChange={(open) => {
          setIsInvoiceOpen(open);
          if (!open) setInvoiceSalesOrderId(null);
        }}
        preselectedSalesOrderId={invoiceSalesOrderId}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
        }}
      />

      {/* View Invoice Dialog */}
      <InvoiceViewDialog
        invoiceId={viewInvoiceId}
        isOpen={isViewInvoiceOpen}
        onClose={() => {
          setIsViewInvoiceOpen(false);
          setViewInvoiceId(null);
        }}
      />
    </>
  );
}
