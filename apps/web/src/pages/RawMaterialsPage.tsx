import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { rawMaterialService } from '../services/raw-material.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { PermissionGuard } from '../components/PermissionGuard';
import { usePermissions } from '../hooks/usePermissions';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SupplierFormDialog } from '@/components/SupplierFormDialog';
import { supplierService } from '../services/supplier.service';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const UNITS = ['KG', 'LITER', 'PIECE'];

const RM_CATEGORIES = [
  'ACTIVE_INGREDIENT',
  'PACKAGING_PRIMARY',
  'PACKAGING_SECONDARY',
  'CARRIER',
  'SOLVENT',
  'ADDITIVE',
  'OTHER',
];

const rawMaterialSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  gst_rate: z.coerce.number().min(0).max(100).optional(),
  hsn_sac_code: z.string().optional(),
  default_unit_price: z.coerce.number().min(0).optional(),
  min_stock_level: z.coerce.number().optional(),
  reorder_point: z.coerce.number().optional(),
  supplier_name: z.string().optional(),
});

type RawMaterialForm = z.infer<typeof rawMaterialSchema>;

export default function RawMaterialsPage() {
  useBreadcrumbs([{ label: 'Raw Materials' }]);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
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
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['raw-materials', page, search, sortBy, sortOrder],
    queryFn: () => rawMaterialService.getAll({ page, limit: 10, search: search || undefined, sortBy, sortOrder }),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierService.getAll({ limit: 1000 }),
  });

  const form = useForm<RawMaterialForm>({
    resolver: zodResolver(rawMaterialSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      category: '',
      subcategory: '',
      unit: '',
      gst_rate: undefined,
      hsn_sac_code: '',
      default_unit_price: undefined,
      min_stock_level: undefined,
      reorder_point: undefined,
      supplier_name: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: rawMaterialService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Raw material created successfully');
      setIsModalOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create raw material');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RawMaterialForm> }) =>
      rawMaterialService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Raw material updated successfully');
      setIsModalOpen(false);
      setEditingId(null);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update raw material');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: rawMaterialService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Raw material deleted successfully');
      setIsConfirmOpen(false);
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete raw material');
      setIsConfirmOpen(false);
      setDeletingId(null);
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: supplierService.create,
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      form.setValue('supplier_name', supplier.company_name);
      setIsSupplierDialogOpen(false);
      setNewSupplierName('');
      toast.success('Supplier created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create supplier');
    },
  });

  const handleCreate = async () => {
    setEditingId(null);
    try {
      const code = await rawMaterialService.getNextCode();
      form.reset({
        code,
        name: '',
        description: '',
        category: '',
        subcategory: '',
        unit: '',
        gst_rate: undefined,
        hsn_sac_code: '',
        default_unit_price: undefined,
        min_stock_level: undefined,
        reorder_point: undefined,
        supplier_name: '',
      });
    } catch (error) {
      form.reset();
    }
    setIsModalOpen(true);
  };

  const handleEdit = async (rawMaterialOrId: any) => {
    try {
      // Handle both string ID and row object
      const id = typeof rawMaterialOrId === 'string' ? rawMaterialOrId : rawMaterialOrId.id;

      // Fetch fresh data from API
      const freshData = await rawMaterialService.getById(id);
      setEditingId(freshData.id);
      form.reset({
        code: freshData.code,
        name: freshData.name,
        description: freshData.description || '',
        category: freshData.category,
        subcategory: freshData.subcategory || '',
        unit: freshData.unit,
        gst_rate: freshData.gst_rate ?? undefined,
        hsn_sac_code: freshData.hsn_sac_code || '',
        default_unit_price: freshData.default_unit_price ?? undefined,
        min_stock_level: freshData.min_stock_level,
        reorder_point: freshData.reorder_point,
        supplier_name: freshData.supplier_name || '',
      });
      setIsModalOpen(true);
    } catch (error) {
      toast.error('Failed to load raw material details');
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const onSubmit = (data: RawMaterialForm) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const exportToExcel = async () => {
    try {
      const allData = await rawMaterialService.getAll({ page: 1, limit: 1000 });
      const rawMaterials = allData.raw_materials || [];

      const exportData = rawMaterials.map((rm: any) => ({
        'Code': rm.code,
        'Name': rm.name,
        'Description': rm.description || '-',
        'Category': rm.category,
        'Subcategory': rm.subcategory || '-',
        'Unit': rm.unit,
        'Min Stock Level': rm.min_stock_level || '-',
        'Reorder Point': rm.reorder_point || '-',
        'Supplier': rm.supplier_name || '-',
        'Created At': rm.created_at ? format(new Date(rm.created_at), 'yyyy-MM-dd HH:mm:ss') : '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Raw Materials');

      const fileName = `raw_materials_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('Raw materials exported successfully');
    } catch (error) {
      toast.error('Failed to export raw materials');
    }
  };

  const columns = [
    {
      header: 'Code',
      accessor: 'code',
      sortKey: 'code',
      cell: (row: any) => <span className="font-medium">{row.code}</span>,
    },
    {
      header: 'Name',
      accessor: 'name',
      sortKey: 'name',
    },
    {
      header: 'Category',
      accessor: 'category',
      sortKey: 'category',
      cell: (row: any) => (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          {row.category.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Unit',
      accessor: 'unit',
    },
    {
      header: 'Stock',
      accessor: 'current_stock_quantity',
      sortKey: 'current_stock_quantity',
      cell: (row: any) => row.current_stock_quantity ?? '-',
    },
    {
      header: 'Supplier',
      accessor: 'supplier_name',
      cell: (row: any) => row.supplier_name || '-',
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
  ];

  const supplierOptions = suppliersData?.suppliers?.map((supplier: any) => ({
    value: supplier.company_name,
    label: supplier.company_name,
  })) || [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Raw Materials</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage raw materials and ingredients</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PermissionGuard permission="raw-materials:view">
              <Button variant="outline" onClick={exportToExcel} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="raw-materials:manage">
              <Button onClick={handleCreate} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                New Raw Material
              </Button>
            </PermissionGuard>
          </div>
        </div>

        <DataTable
          title="All Raw Materials"
          description={`${data?.pagination?.total || 0} total raw materials`}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          columns={columns}
          data={data?.raw_materials || []}
          rowId="id"
          rowActions={() => {
            if (!hasPermission('raw-materials:manage')) return [];
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
          pagination={data?.pagination}
          onPageChange={setPage}
          loading={isLoading}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search by code, name, category..."
          onPrimaryColumnClick={(id) => handleEdit(id)}
        />
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Raw Material' : 'Add Raw Material'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update raw material details'
                : 'Add a new raw material to the system'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code (Auto-generated)</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly className="bg-muted" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nitrogen Compound" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Material description..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RM_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat.replace(/_/g, ' ')}
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
                  name="subcategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subcategory</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  name="supplier_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <FormControl>
                        <SearchableCombobox
                          options={supplierOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select or add supplier..."
                          allowAdd
                          onAddNew={(name) => {
                            setNewSupplierName(name);
                            setIsSupplierDialogOpen(true);
                          }}
                          label="supplier"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="gst_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST Rate (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="18" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hsn_sac_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HSN/SAC Code</FormLabel>
                      <FormControl>
                        <Input placeholder="3923" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="default_unit_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Unit Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="15.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min_stock_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Stock Level</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reorder_point"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="500" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                    form.reset();
                  }}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingId
                    ? 'Update'
                    : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setDeletingId(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Raw Material"
        message="Are you sure you want to delete this raw material? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />

      {/* Supplier Dialog */}
      <SupplierFormDialog
        open={isSupplierDialogOpen}
        onClose={() => {
          setIsSupplierDialogOpen(false);
          setNewSupplierName('');
        }}
        onSubmit={(data) => createSupplierMutation.mutate(data)}
        isLoading={createSupplierMutation.isPending}
        defaultCompanyName={newSupplierName}
      />
    </>
  );
}
