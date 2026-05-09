import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Plus } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { rmBatchService } from '../services/rm-batch.service';
import type { RMBatch } from '../services/rm-batch.service';
import { rawMaterialService } from '../services/raw-material.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { PermissionGuard } from '../components/PermissionGuard';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DataTableColumn, RowAction } from '@/components/ui/data-table';

const UNITS = ['KG', 'LITER', 'PIECE'];

const rmBatchSchema = z.object({
  raw_material_id: z.string().min(1, 'Raw material is required'),
  batch_number: z.string().min(1, 'Batch number is required'),
  receipt_date: z.string().min(1, 'Receipt date is required'),
  expiry_date: z.string().optional(),
  quantity_received: z.coerce.number().min(0.01, 'Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  storage_location: z.string().optional(),
  quality_status: z.string().default('PENDING'),
});

type RMBatchForm = z.infer<typeof rmBatchSchema>;

export default function RMBatchesPage() {
  useBreadcrumbs([{ label: 'RM Batches' }]);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<RMBatch | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['rm-batches', page, search, sortBy, sortOrder],
    queryFn: () => rmBatchService.getAll({ page, limit: 10, search: search || undefined, sortBy, sortOrder }),
  });

  const { data: rawMaterialsData } = useQuery({
    queryKey: ['raw-materials-all'],
    queryFn: () => rawMaterialService.getAll({ page: 1, limit: 1000 }),
  });

  const form = useForm<RMBatchForm>({
    resolver: zodResolver(rmBatchSchema),
    defaultValues: {
      raw_material_id: '',
      batch_number: '',
      receipt_date: format(new Date(), 'yyyy-MM-dd'),
      expiry_date: '',
      quantity_received: undefined,
      unit: '',
      storage_location: '',
      quality_status: 'PENDING',
    },
  });

  const createMutation = useMutation({
    mutationFn: rmBatchService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-batches'] });
      toast.success('RM batch created successfully');
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create RM batch');
    },
  });

  const onSubmit = (data: RMBatchForm) => {
    createMutation.mutate({
      ...data,
      quantity_remaining: data.quantity_received,
    } as any);
  };

  const handleCreateNew = () => {
    form.reset({
      raw_material_id: '',
      batch_number: '',
      receipt_date: format(new Date(), 'yyyy-MM-dd'),
      expiry_date: '',
      quantity_received: undefined,
      unit: '',
      storage_location: '',
      quality_status: 'PENDING',
    });
    setIsCreateOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: rmBatchService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-batches'] });
      toast.success('RM batch deleted successfully');
      setIsConfirmOpen(false);
      setDeletingBatch(null);
    },
    onError: () => {
      toast.error('Failed to delete RM batch');
      setIsConfirmOpen(false);
      setDeletingBatch(null);
    },
  });

  const handleDelete = (id: string) => {
    const batch = data?.rm_batches.find((b) => b.id === id);
    if (batch) {
      setDeletingBatch(batch);
      setIsConfirmOpen(true);
    }
  };

  const confirmDelete = () => {
    if (deletingBatch) {
      deleteMutation.mutate(deletingBatch.id);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const exportToExcel = async () => {
    try {
      toast.info('Exporting RM batches...');

      // Fetch all RM batches (without pagination)
      const allData = await rmBatchService.getAll({ page: 1, limit: 10000 });
      const rmBatches = allData?.rm_batches || [];

      if (!rmBatches || rmBatches.length === 0) {
        toast.error('No RM batches to export');
        return;
      }

      // Create data for Excel
      const excelData = rmBatches.map((batch) => ({
        'Batch Number': batch.batch_number,
        'Raw Material': batch.raw_material?.name || '-',
        'Category': batch.raw_material?.category || '-',
        'Receipt Date': formatDate(batch.receipt_date),
        'Expiry Date': batch.expiry_date ? formatDate(batch.expiry_date) : '-',
        'Quantity Received': batch.quantity_received,
        'Quantity Remaining': batch.quantity_remaining,
        'Unit': batch.unit,
        'Quality Status': batch.quality_status,
        'Storage Location': batch.storage_location || '-',
        'Active': batch.is_active ? 'Yes' : 'No',
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'RM Batches');

      // Auto-size columns
      const maxWidth = excelData.reduce((w: any, r: any) => {
        return Object.keys(r).map((k, i) => Math.max(w[i] || 10, String(r[k]).length));
      }, []);
      ws['!cols'] = maxWidth.map((w: number) => ({ wch: w + 2 }));

      // Download
      XLSX.writeFile(wb, `rm-batches-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success(`${rmBatches.length} RM batches exported successfully`);
    } catch (error) {
      toast.error('Failed to export RM batches');
    }
  };

  // Get stock status based on quantity remaining
  const getStockStatus = (batch: RMBatch): string => {
    const percentageRemaining = (batch.quantity_remaining / batch.quantity_received) * 100;
    if (percentageRemaining === 0) return 'OUT_OF_STOCK';
    if (percentageRemaining <= 20) return 'LOW_STOCK';
    return 'IN_STOCK';
  };

  // Define DataTable columns
  const columns: DataTableColumn<RMBatch>[] = [
    {
      header: 'Batch Number',
      accessor: 'batch_number',
      sortKey: 'batch_number',
      cell: (row) => <span className="font-medium">{row.batch_number}</span>,
    },
    {
      header: 'Raw Material',
      accessor: (row) => row.raw_material?.name || '-',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.raw_material?.name || '-'}</div>
          {row.raw_material?.category && (
            <div className="text-sm text-muted-foreground">{row.raw_material.category}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Receipt Date',
      accessor: 'receipt_date',
      sortKey: 'receipt_date',
      cell: (row) => formatDate(row.receipt_date),
    },
    {
      header: 'Expiry Date',
      accessor: 'expiry_date',
      cell: (row) => (row.expiry_date ? formatDate(row.expiry_date) : '-'),
    },
    {
      header: 'Stock',
      accessor: (row) => `${row.quantity_remaining} / ${row.quantity_received}`,
      sortKey: 'quantity_remaining',
      cell: (row) => (
        <div>
          <div className="font-medium">
            {row.quantity_remaining} / {row.quantity_received} {row.unit}
          </div>
          <div className="text-xs text-muted-foreground">
            {Math.round((row.quantity_remaining / row.quantity_received) * 100)}% remaining
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => getStockStatus(row),
      cell: (row) => {
        const status = getStockStatus(row);
        return <StatusBadge status={status} />;
      },
    },
    {
      header: 'Quality',
      accessor: 'quality_status',
      sortKey: 'quality_status',
      cell: (row) => <StatusBadge status={row.quality_status} />,
    },
    {
      header: 'Activity',
      accessor: 'created_at' as any,
      sortKey: 'created_at',
      cell: (row: any) => (
        <div className="text-xs space-y-0.5">
          <div><span className="font-medium">{row.creator?.name || '-'}</span> <span className="text-muted-foreground">{row.created_at ? format(new Date(row.created_at), 'MMM dd, yyyy') : ''}</span></div>
          {row.updater && <div className="text-muted-foreground">edited by <span className="font-medium text-foreground">{row.updater.name}</span></div>}
        </div>
      ),
    },
  ];

  // Define row actions
  const rowActions: RowAction[] = [
    {
      type: 'view',
      label: 'View Details',
      onClick: (id) => {
        // TODO: Implement view details
        toast.info('View details coming soon');
      },
    },
    {
      type: 'delete',
      label: 'Delete',
      onClick: handleDelete,
      destructive: true,
    },
  ];

  const rmBatches = data?.rm_batches || [];

  return (
    <>
      <PageHeader
        title="Raw Material Batches"
        description="View and manage raw material inventory batches"
        actions={[
          {
            label: 'Export Excel',
            icon: Download,
            variant: 'outline',
            onClick: exportToExcel,
          },
          {
            label: 'New RM Batch',
            icon: Plus,
            onClick: handleCreateNew,
          },
        ]}
      />

      <DataTable
        title="All RM Batches"
        description={`${data?.pagination?.total || 0} total RM batches`}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        columns={columns}
        data={rmBatches}
        rowId="id"
        rowActions={rowActions}
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
        emptyMessage="No RM batches found. RM batches are created when purchase orders are received."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by batch number, raw material..."
      />

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setDeletingBatch(null);
        }}
        onConfirm={confirmDelete}
        title="Delete RM Batch"
        message={`Are you sure you want to delete RM batch ${deletingBatch?.batch_number}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        loading={deleteMutation.isPending}
      />

      {/* Create RM Batch Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add RM Batch</DialogTitle>
            <DialogDescription>
              Receive a new raw material batch into inventory
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="raw_material_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Raw Material *</FormLabel>
                      <Select onValueChange={(val) => {
                        field.onChange(val);
                        // Auto-fill unit from raw material
                        const rm = rawMaterialsData?.raw_materials?.find((r: any) => r.id === val);
                        if (rm) form.setValue('unit', rm.unit);
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select raw material" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rawMaterialsData?.raw_materials?.map((rm: any) => (
                            <SelectItem key={rm.id} value={rm.id}>
                              {rm.code} - {rm.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="batch_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="RMB-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="receipt_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiry_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="quantity_received"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity Received *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quality_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quality Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="APPROVED">Approved</SelectItem>
                          <SelectItem value="REJECTED">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="storage_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Warehouse A, Shelf B3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    form.reset();
                  }}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Batch'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
