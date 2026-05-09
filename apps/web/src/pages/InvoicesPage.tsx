import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Eye, FileDown, Loader2, IndianRupee, ScanBarcode } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '../components/ui/button';
import { invoiceService, type Invoice } from '../services/invoice.service';
import { InvoiceViewDialog } from '@/components/InvoiceViewDialog';
import { InvoiceFormDialog } from '@/components/InvoiceFormDialog';
import { RecordPaymentDialog } from '@/components/RecordPaymentDialog';
import { ScanPayDialog } from '@/components/ScanPayDialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PermissionGuard } from '@/components/PermissionGuard';
import type { DataTableColumn, RowAction } from '@/components/ui/data-table';

export default function InvoicesPage() {
  useBreadcrumbs([{ label: 'Invoices' }]);
  const queryClient = useQueryClient();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('invoice_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [isScanPayOpen, setIsScanPayOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const limit = 20;

  // Global barcode scanner listener
  useBarcodeScanner(
    (barcode) => {
      setScannedBarcode(barcode);
      setIsScanPayOpen(true);
    },
    { enabled: !isScanPayOpen, prefix: 'INV' }
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search, sortBy, sortOrder],
    queryFn: () => invoiceService.getInvoices({ page, limit: 20, search: search || undefined, sortBy, sortOrder }),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleExportExcel = useCallback(() => {
    if (!data?.invoices || data.invoices.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no invoices to export.',
        variant: 'destructive',
      });
      return;
    }

    const exportData = data.invoices.map((invoice) => ({
      'Invoice Number': invoice.invoice_number,
      'Customer': invoice.customer?.company_name || invoice.customer?.client_name || 'N/A',
      'Invoice Date': format(new Date(invoice.invoice_date), 'dd/MM/yyyy'),
      'Due Date': format(new Date(invoice.due_date), 'dd/MM/yyyy'),
      'Status': invoice.status,
      'Amount': invoice.grand_total,
      'Amount Paid': invoice.amount_paid,
      'Amount Due': invoice.amount_due,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

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

    XLSX.writeFile(wb, `invoices-${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: 'Export successful',
      description: `Exported ${data.invoices.length} invoices to Excel.`,
    });
  }, [data]);

  const handleViewInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setIsViewDialogOpen(true);
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      setDownloadingId(invoice.id);
      await invoiceService.downloadInvoicePDF(invoice.id, invoice.invoice_number);
      toast({
        title: 'Download started',
        description: `Invoice ${invoice.invoice_number} PDF is being downloaded.`,
      });
    } catch (error: any) {
      toast({
        title: 'Download failed',
        description: error?.response?.data?.error || 'Failed to download invoice PDF.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const invoices = data?.invoices || [];

  const columns: DataTableColumn[] = [
    { header: 'Invoice Number', accessor: 'invoice_number', sortKey: 'invoice_number', cellClassName: 'font-medium' },
    {
      header: 'Customer',
      accessor: 'customer',
      cell: (row: any) => row.customer?.company_name || row.customer?.client_name || 'N/A',
    },
    {
      header: 'Invoice Date',
      accessor: 'invoice_date',
      sortKey: 'invoice_date',
      cell: (row: any) => format(new Date(row.invoice_date), 'dd MMM yyyy'),
    },
    {
      header: 'Due Date',
      accessor: 'due_date',
      sortKey: 'due_date',
      cell: (row: any) => format(new Date(row.due_date), 'dd MMM yyyy'),
    },
    {
      header: 'Amount',
      accessor: 'grand_total',
      sortKey: 'grand_total',
      cell: (row: any) => formatCurrency(row.grand_total),
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
    {
      header: 'Amount Due',
      accessor: 'amount_due',
      cell: (row: any) => formatCurrency(row.amount_due),
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
    {
      header: 'Status',
      accessor: 'status',
      sortKey: 'status',
      cell: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Activity',
      accessor: 'created_at',
      sortKey: 'created_at',
      cell: (row: any) => (
        <div className="text-xs space-y-0.5">
          <div><span className="font-medium">{row.creator?.name || '-'}</span> <span className="text-muted-foreground">{row.created_at ? format(new Date(row.created_at), 'dd MMM yyyy') : ''}</span></div>
          {row.updater && <div className="text-muted-foreground">edited by <span className="font-medium text-foreground">{row.updater.name}</span></div>}
        </div>
      ),
    },
  ];

  const handleRecordPayment = (invoiceId: string) => {
    const invoice = invoices.find((inv: Invoice) => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoiceForPayment(invoice);
      setIsPaymentDialogOpen(true);
    }
  };

  const handleEditInvoice = async (invoiceId: string) => {
    try {
      // Always fetch fresh data from backend for edit
      const { invoice } = await invoiceService.getInvoiceById(invoiceId);
      setEditingInvoice(invoice);
      setIsFormDialogOpen(true);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load invoice for editing.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setIsFormDialogOpen(true);
  };

  const getRowActions = (row: any): RowAction[] => {
    const actions: RowAction[] = [
      { type: 'view', label: 'View', onClick: handleViewInvoice },
    ];

    // Add "Edit" action for DRAFT and SENT invoices
    if (row.status === 'DRAFT' || row.status === 'SENT') {
      actions.push({
        type: 'edit',
        label: 'Edit',
        onClick: handleEditInvoice,
      });
    }

    actions.push({
      type: 'custom',
      label: downloadingId === row.id ? 'Downloading...' : 'Download PDF',
      icon: downloadingId === row.id ? Loader2 : FileDown,
      onClick: (id: string) => {
        const invoice = invoices.find((inv: Invoice) => inv.id === id);
        if (invoice) handleDownloadPDF(invoice);
      },
    });

    // Add "Record Payment" action if invoice has outstanding amount
    if (row.amount_due > 0 && row.status !== 'CANCELLED') {
      actions.push({
        type: 'custom',
        label: 'Record Payment',
        icon: IndianRupee,
        onClick: handleRecordPayment,
      });
    }

    return actions;
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Manage customer invoices and billing"
        actions={
          <>
            <PermissionGuard permission="invoices:view">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleExportExcel}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="payments:manage">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-teal-600 text-teal-600 hover:bg-teal-50"
                onClick={() => {
                  setScannedBarcode(null);
                  setIsScanPayOpen(true);
                }}
              >
                <ScanBarcode className="mr-2 h-4 w-4" />
                Scan & Pay
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="invoices:manage">
              <Button
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700"
                onClick={handleCreateInvoice}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </PermissionGuard>
          </>
        }
      />

      <DataTable
        title="All Invoices"
        description={`${data?.pagination?.total || 0} total invoices`}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        columns={columns}
        data={invoices}
        rowId="id"
        rowActions={getRowActions}
        pagination={data?.pagination}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No invoices found"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by invoice number, customer..."
        onRowClick={(id) => handleViewInvoice(id)}
        onPrimaryColumnClick={(id) => handleViewInvoice(id)}
      />

      {/* Invoice View Dialog */}
      <InvoiceViewDialog
        invoiceId={selectedInvoiceId}
        isOpen={isViewDialogOpen}
        onClose={() => {
          setIsViewDialogOpen(false);
          setSelectedInvoiceId(null);
        }}
      />

      {/* Create / Edit Invoice Dialog */}
      <InvoiceFormDialog
        open={isFormDialogOpen}
        onOpenChange={(open) => {
          setIsFormDialogOpen(open);
          if (!open) setEditingInvoice(null);
        }}
        invoice={editingInvoice}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
        }}
      />

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => {
          setIsPaymentDialogOpen(false);
          setSelectedInvoiceForPayment(null);
        }}
        invoice={selectedInvoiceForPayment ? {
          id: selectedInvoiceForPayment.id,
          invoice_number: selectedInvoiceForPayment.invoice_number,
          grand_total: selectedInvoiceForPayment.grand_total,
          amount_paid: selectedInvoiceForPayment.amount_paid,
          amount_due: selectedInvoiceForPayment.amount_due,
          customer: selectedInvoiceForPayment.customer,
        } : null}
      />

      {/* Scan & Pay Dialog */}
      <ScanPayDialog
        isOpen={isScanPayOpen}
        onClose={() => {
          setIsScanPayOpen(false);
          setScannedBarcode(null);
        }}
        initialBarcode={scannedBarcode}
      />
    </>
  );
}
