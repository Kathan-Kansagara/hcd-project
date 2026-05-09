import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Factory } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { batchService } from '../services/batch.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import ProductionFormWizard from '../components/production/ProductionFormWizard';
import type { DataTableColumn, RowAction } from '@/components/ui/data-table';

export default function ProductionPage() {
  useBreadcrumbs([{ label: 'Production' }]);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const limit = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['batches', page, search],
    queryFn: () => batchService.getAll({ page, limit, search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: batchService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['rm-batches'] });
      setDeletingId(null);
      toast.success('Production batch deleted successfully');
    },
    onError: () => {
      setDeletingId(null);
      toast.error('Failed to delete batch');
    },
  });

  const handleCreate = () => {
    setIsModalOpen(true);
  };

  const handleDelete = (batchId: string) => {
    setDeletingId(batchId);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const exportToExcel = async () => {
    try {
      toast.info('Exporting production batches...');

      const allBatches = await batchService.getAll({ page: 1, limit: 10000 });
      const batchesData = (allBatches as any)?.batches || [];

      if (!batchesData || batchesData.length === 0) {
        toast.error('No production batches to export');
        return;
      }

      const exportData = batchesData.map((batch: any) => ({
        'Batch Number': batch.batch_number,
        'Product': batch.product?.name || '-',
        'Manufacturing Date': format(new Date(batch.manufacturing_date), 'MMM dd, yyyy'),
        'Expiry Date': format(new Date(batch.expiry_date), 'MMM dd, yyyy'),
        'Quantity Produced': `${batch.quantity_produced} ${batch.unit}`,
        'Quantity Remaining': `${batch.quantity_remaining} ${batch.unit}`,
        'Storage Location': batch.storage_location || '-',
        'Status': batch.expiry_status === 'expired' ? 'Expired' : batch.expiry_status === 'expiring_soon' ? 'Expiring Soon' : 'Active'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Production Batches');

      const maxWidth = exportData.reduce((w: any, r: any) => {
        return Object.keys(r).map((k, i) => Math.max(w[i] || 10, String(r[k]).length));
      }, []);
      ws['!cols'] = maxWidth.map((w: number) => ({ wch: w + 2 }));

      XLSX.writeFile(wb, `production-batches-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success(`${batchesData.length} production batches exported successfully`);
    } catch (error) {
      toast.error('Failed to export production batches');
    }
  };

  const batches = (data as any)?.batches || [];

  const columns: DataTableColumn[] = [
    { header: 'Batch Number', accessor: 'batch_number', cellClassName: 'font-medium' },
    {
      header: 'Product',
      accessor: 'product',
      cell: (row: any) => row.product?.name || '-',
    },
    {
      header: 'Manufacturing Date',
      accessor: 'manufacturing_date',
      cell: (row: any) => format(new Date(row.manufacturing_date), 'MMM dd, yyyy'),
    },
    {
      header: 'Expiry Date',
      accessor: 'expiry_date',
      cell: (row: any) => format(new Date(row.expiry_date), 'MMM dd, yyyy'),
    },
    {
      header: 'Stock',
      accessor: 'quantity_remaining',
      cell: (row: any) => `${row.quantity_remaining} / ${row.quantity_produced} ${row.unit}`,
    },
    {
      header: 'Status',
      accessor: 'expiry_status',
      cell: (row: any) => (
        <StatusBadge
          status={row.expiry_status === 'expired' ? 'EXPIRED' : row.expiry_status === 'expiring_soon' ? 'EXPIRING_SOON' : 'ACTIVE'}
        />
      ),
    },
  ];

  const rowActions: RowAction[] = [
    { type: 'delete', label: 'Delete', onClick: handleDelete, destructive: true },
  ];

  return (
    <>
      <PageHeader
        title="Production"
        description="Create finished product batches and record raw material consumption"
        actions={
          <>
            <Button variant="outline" onClick={exportToExcel} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button onClick={handleCreate} className="w-full sm:w-auto">
              <Factory className="mr-2 h-4 w-4" />
              Create Production Batch
            </Button>
          </>
        }
      />

      <DataTable
        title="Production Batches"
        description={
          data?.pagination?.total
            ? `${data.pagination.total} total production batch${data.pagination.total !== 1 ? 'es' : ''}`
            : 'Finished product batches with raw material traceability'
        }
        columns={columns}
        data={batches}
        rowId="id"
        rowActions={rowActions}
        pagination={data?.pagination}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No production batches found. Create your first production batch."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by batch number, product..."
      />

      <ProductionFormWizard
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['batches'] });
          queryClient.invalidateQueries({ queryKey: ['rm-batches'] });
          setIsModalOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        title="Delete Production Batch"
        message="Are you sure you want to delete this production batch? This action cannot be undone and may affect stock calculations."
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
