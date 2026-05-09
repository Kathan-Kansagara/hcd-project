import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, User, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { customerService } from '../services/customer.service';
import type { Customer, CreateCustomerData } from '../services/customer.service';
import { CustomerFormDialog } from '../components/CustomerFormDialog';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { PermissionGuard } from '../components/PermissionGuard';
import { usePermissions } from '../hooks/usePermissions';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function CustomersPage() {
  useBreadcrumbs([{ label: 'Customers' }]);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
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
    queryKey: ['customers', page, search, sortBy, sortOrder],
    queryFn: () => customerService.getAll({ page, limit: 10, search: search || undefined, sortBy, sortOrder }),
  });

  const createMutation = useMutation({
    mutationFn: customerService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created successfully');
      setIsFormOpen(false);
    },
    onError: () => {
      toast.error('Failed to create customer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateCustomerData }) => customerService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated successfully');
      setIsFormOpen(false);
      setEditingCustomer(null);
    },
    onError: () => {
      toast.error('Failed to update customer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: customerService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted successfully');
      setIsConfirmOpen(false);
      setDeletingId(null);
    },
    onError: () => {
      toast.error('Failed to delete customer');
      setIsConfirmOpen(false);
      setDeletingId(null);
    },
  });

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setIsFormOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  const handleDeleteCustomer = (id: string) => {
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const handleFormSubmit = (data: CreateCustomerData) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingCustomer(null);
  };

  const exportToExcel = async () => {
    try {
      const allData = await customerService.getAll({ page: 1, limit: 1000 });
      const customers = allData.customers || [];

      const exportData = customers.map((customer) => ({
        'Company Name': customer.company_name,
        'Client Name': customer.client_name || '-',
        'Contact': customer.contact,
        'Email': customer.email,
        'Address Line 1': customer.address_line1,
        'Address Line 2': customer.address_line2 || '-',
        'City': customer.city,
        'State': customer.state,
        'Pincode': customer.pincode,
        'GSTIN': customer.gstin || '-',
        'Place of Supply': customer.place_of_supply,
        'Payment Terms': customer.payment_terms,
        'Status': customer.is_active ? 'Active' : 'Inactive',
        'Created At': customer.created_at ? format(new Date(customer.created_at), 'yyyy-MM-dd HH:mm:ss') : '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

      const fileName = `customers_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('Customers exported successfully');
    } catch (error) {
      toast.error('Failed to export customers');
    }
  };

  const columns = [
    {
      header: 'Type',
      accessor: 'customer_type',
      cell: (row: Customer) => (
        <div className="flex items-center gap-1.5">
          {row.customer_type === 'individual' ? (
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
      header: 'Name',
      accessor: 'company_name',
      sortKey: 'company_name',
      cell: (row: Customer) => <span className="font-medium">{row.company_name}</span>,
    },
    {
      header: 'Contact Person',
      accessor: 'client_name',
      cell: (row: Customer) => row.client_name || '-',
    },
    {
      header: 'Phone',
      accessor: 'contact',
    },
    {
      header: 'Email',
      accessor: 'email',
      sortKey: 'email',
      cell: (row: Customer) => row.email || '-',
    },
    {
      header: 'GSTIN',
      accessor: 'gstin',
      cell: (row: Customer) => row.gstin || '-',
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
      cell: (row: Customer) => (
        <Badge
          variant={row.is_active ? 'default' : 'secondary'}
          className={row.is_active ? 'bg-teal-100 text-teal-800 hover:bg-teal-100' : ''}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage customer information and contacts</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PermissionGuard permission="customers:view">
              <Button variant="outline" onClick={exportToExcel} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="customers:manage">
              <Button onClick={handleAddCustomer} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                New Customer
              </Button>
            </PermissionGuard>
          </div>
        </div>

        <DataTable
          title="All Customers"
          description={`${data?.pagination?.total || 0} total customers`}
          columns={columns}
          data={data?.customers || []}
          rowId="id"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          rowActions={() => {
            if (!hasPermission('customers:manage')) return [];
            return [
              {
                type: 'edit',
                label: 'Edit',
                onClick: (id: string) => {
                  const customer = (data?.customers || []).find((c: Customer) => c.id === id);
                  if (customer) handleEditCustomer(customer);
                },
              },
              {
                type: 'delete',
                label: 'Delete',
                onClick: handleDeleteCustomer,
                destructive: true,
              },
            ];
          }}
          pagination={data?.pagination}
          onPageChange={setPage}
          loading={isLoading}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search by company name, contact, email..."
          onPrimaryColumnClick={(id) => {
            const customer = (data?.customers || []).find((c: Customer) => c.id === id);
            if (customer) handleEditCustomer(customer);
          }}
        />
      </div>

      <CustomerFormDialog
        open={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        customer={editingCustomer}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setDeletingId(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
