import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, ScanBarcode } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '../components/ui/button';
import { paymentService, type Payment } from '../services/payment.service';
import { RecordPaymentDialog } from '@/components/RecordPaymentDialog';
import { ScanPayDialog } from '@/components/ScanPayDialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PermissionGuard } from '@/components/PermissionGuard';
import type { DataTableColumn } from '@/components/ui/data-table';

export default function PaymentsPage() {
  useBreadcrumbs([{ label: 'Payments' }]);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('payment_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isScanPayOpen, setIsScanPayOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  // Global barcode scanner listener
  useBarcodeScanner(
    (barcode) => {
      setScannedBarcode(barcode);
      setIsScanPayOpen(true);
    },
    { enabled: !isScanPayOpen, prefix: 'INV' }
  );

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };
  const limit = 20;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, search, sortBy, sortOrder],
    queryFn: () => paymentService.getPayments({ page, limit: 20, search: search || undefined, sortBy, sortOrder }),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleExportExcel = useCallback(() => {
    if (!data?.payments || data.payments.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no payments to export.',
        variant: 'destructive',
      });
      return;
    }

    const exportData = data.payments.map((payment) => ({
      'Payment Number': payment.payment_number,
      'Invoice Number': payment.invoice?.invoice_number || 'N/A',
      'Customer': payment.invoice?.customer?.company_name || payment.invoice?.customer?.client_name || 'N/A',
      'Payment Date': format(new Date(payment.payment_date), 'dd/MM/yyyy'),
      'Amount': payment.amount,
      'Payment Method': payment.payment_method.replace('_', ' '),
      'Reference': payment.reference_number || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');

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

    XLSX.writeFile(wb, `payments-${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: 'Export successful',
      description: `Exported ${data.payments.length} payments to Excel.`,
    });
  }, [data]);

  const payments = data?.payments || [];

  const columns: DataTableColumn[] = [
    { header: 'Payment Number', accessor: 'payment_number', sortKey: 'payment_number', cellClassName: 'font-medium' },
    {
      header: 'Invoice Number',
      accessor: 'invoice',
      cell: (row: any) => row.invoice?.invoice_number || 'N/A',
    },
    {
      header: 'Customer',
      accessor: 'customer',
      cell: (row: any) =>
        row.invoice?.customer?.company_name || row.invoice?.customer?.client_name || 'N/A',
    },
    {
      header: 'Payment Date',
      accessor: 'payment_date',
      sortKey: 'payment_date',
      cell: (row: any) => format(new Date(row.payment_date), 'dd MMM yyyy'),
    },
    {
      header: 'Amount',
      accessor: 'amount',
      sortKey: 'amount',
      cell: (row: any) => formatCurrency(row.amount),
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
    {
      header: 'Payment Method',
      accessor: 'payment_method',
      sortKey: 'payment_method',
      cell: (row: any) => (
        <StatusBadge
          status={row.payment_method}
          customConfig={{
            CASH: { color: 'bg-green-100 text-green-800', label: 'Cash' },
            CHEQUE: { color: 'bg-blue-100 text-blue-800', label: 'Cheque' },
            BANK_TRANSFER: { color: 'bg-purple-100 text-purple-800', label: 'Bank Transfer' },
            UPI: { color: 'bg-orange-100 text-orange-800', label: 'UPI' },
            CREDIT_CARD: { color: 'bg-pink-100 text-pink-800', label: 'Card' },
            OTHER: { color: 'bg-gray-100 text-gray-800', label: 'Other' },
          }}
        />
      ),
    },
    {
      header: 'Reference',
      accessor: 'reference_number',
      cell: (row: any) => row.reference_number || '-',
    },
    {
      header: 'Created By',
      accessor: 'creator',
      cell: (row: any) => (
        <span className="text-xs font-medium">{row.creator?.name || '-'}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        description="Track and manage customer payments"
        actions={
          <>
            <PermissionGuard permission="payments:view">
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
            <PermissionGuard permission="payments:manage">
              <Button
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700"
                onClick={() => setIsPaymentDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </PermissionGuard>
          </>
        }
      />

      <DataTable
        title="All Payments"
        description={`${data?.pagination?.total || 0} total payments`}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        columns={columns}
        data={payments}
        rowId="id"
        pagination={data?.pagination}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No payments found"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by payment number, invoice, customer..."
      />

      {/* Record Payment Dialog (with invoice picker) */}
      <RecordPaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
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
