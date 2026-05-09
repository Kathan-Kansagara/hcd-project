import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supplierService } from '../services/supplier.service';
import type { Supplier, CreateSupplierData } from '../services/supplier.service';
import { SupplierFormDialog } from '../components/SupplierFormDialog';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { PermissionGuard } from '../components/PermissionGuard';
import { usePermissions } from '../hooks/usePermissions';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function SuppliersPage() {
  useBreadcrumbs([{ label: 'Suppliers' }]);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search, sortBy, sortOrder],
    queryFn: () => supplierService.getAll({ page, limit: 10, search: search || undefined, sortBy, sortOrder }),
  });

  const createMutation = useMutation({
    mutationFn: supplierService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier created successfully');
      setIsFormOpen(false);
      setEditingSupplier(null);
    },
    onError: () => {
      toast.error('Failed to create supplier');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateSupplierData }) =>
      supplierService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier updated successfully');
      setIsFormOpen(false);
      setEditingSupplier(null);
    },
    onError: () => {
      toast.error('Failed to update supplier');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: supplierService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.success('Supplier deleted successfully');
    },
    onError: () => {
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.error('Failed to delete supplier');
    },
  });

  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setIsFormOpen(true);
  };

  const handleEdit = (supplierId: string) => {
    const supplier = data?.suppliers?.find((s) => s.id === supplierId);
    if (supplier) {
      setEditingSupplier(supplier);
      setIsFormOpen(true);
    }
  };

  const handleDelete = (supplierId: string) => {
    setDeletingId(supplierId);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const handleFormSubmit = (formData: CreateSupplierData) => {
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingSupplier(null);
  };

  const exportToExcel = async () => {
    try {
      toast.info('Exporting suppliers...');

      // Fetch all suppliers (without pagination)
      const allSuppliers = await supplierService.getAll({ page: 1, limit: 10000 });
      const suppliersData = allSuppliers.suppliers || [];

      if (!suppliersData || suppliersData.length === 0) {
        toast.error('No suppliers to export');
        return;
      }

      // Create data for Excel
      const excelData = suppliersData.map((supplier) => ({
        'Company Name': supplier.company_name,
        'Contact Person': supplier.contact_person || '-',
        'Contact': supplier.contact,
        'Email': supplier.email,
        'Address Line 1': supplier.address_line1,
        'Address Line 2': supplier.address_line2 || '-',
        'City': supplier.city,
        'State': supplier.state,
        'Pincode': supplier.pincode,
        'GSTIN': supplier.gstin || '-',
        'Payment Terms': supplier.payment_terms,
        'Status': supplier.is_active ? 'Active' : 'Inactive',
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');

      // Auto-size columns
      const maxWidth = excelData.reduce((w: any, r: any) => {
        return Object.keys(r).map((k, i) => Math.max(w[i] || 10, String(r[k]).length));
      }, []);
      ws['!cols'] = maxWidth.map((w: number) => ({ wch: w + 2 }));

      // Download
      XLSX.writeFile(wb, `suppliers-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success(`${suppliersData.length} suppliers exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export suppliers');
    }
  };

  const suppliers = data?.suppliers || [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Suppliers</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage supplier information and contacts</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PermissionGuard permission="suppliers:view">
              <Button variant="outline" onClick={exportToExcel} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="suppliers:manage">
              <Button onClick={handleAddSupplier} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                New Supplier
              </Button>
            </PermissionGuard>
          </div>
        </div>

        <DataTable
          title="All Suppliers"
          description={`${data?.pagination?.total || 0} total suppliers`}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          columns={[
            {
              header: 'Company Name',
              accessor: 'company_name',
              sortKey: 'company_name',
              cell: (row) => <span className="font-medium">{row.company_name}</span>,
            },
            {
              header: 'Contact Person',
              accessor: 'contact_person',
              cell: (row) => row.contact_person || '-',
            },
            {
              header: 'Contact',
              accessor: 'contact',
            },
            {
              header: 'Email',
              accessor: 'email',
              sortKey: 'email',
            },
            {
              header: 'City',
              accessor: 'city',
            },
            {
              header: 'GSTIN',
              accessor: 'gstin',
              cell: (row) => row.gstin || '-',
            },
            {
              header: 'Payment Terms',
              accessor: 'payment_terms',
            },
            {
              header: 'Activity',
              accessor: 'created_at',
              sortKey: 'created_at',
              cell: (row: any) => (
                <div className="text-xs space-y-0.5">
                  <div><span className="font-medium">{row.creator?.name || '-'}</span> <span className="text-muted-foreground">{row.created_at ? format(new Date(row.created_at), 'MMM dd, yyyy') : ''}</span></div>
                  {row.updater && <div className="text-muted-foreground">edited by <span className="font-medium text-foreground">{row.updater.name}</span></div>}
                </div>
              ),
            },
            {
              header: 'Status',
              accessor: 'is_active',
              cell: (row) => (
                <Badge
                  variant={row.is_active ? 'default' : 'outline'}
                  className={row.is_active ? 'bg-primary text-primary-foreground' : ''}
                >
                  {row.is_active ? 'Active' : 'Inactive'}
                </Badge>
              ),
            },
          ]}
          data={suppliers}
          rowId="id"
          rowActions={() => {
            if (!hasPermission('suppliers:manage')) return [];
            return [
              {
                type: 'edit',
                label: 'Edit',
                onClick: handleEdit,
              },
              {
                type: 'delete',
                label: 'Delete',
                onClick: handleDelete,
                destructive: true,
              },
            ];
          }}
          pagination={
            data?.pagination
              ? {
                  currentPage: data.pagination.page,
                  totalPages: data.pagination.totalPages,
                  total: data.pagination.total,
                  limit: data.pagination.limit,
                }
              : undefined
          }
          onPageChange={setPage}
          loading={isLoading}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search by company name, contact, email..."
          onPrimaryColumnClick={(id) => handleEdit(id)}
        />
      </div>

      <SupplierFormDialog
        open={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        supplier={editingSupplier}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
