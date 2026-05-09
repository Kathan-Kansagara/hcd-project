import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Plus, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { productService } from '../services/product.service';
import type { Product } from '../types';
import LayoutNew from '../components/layout/LayoutNew';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['products', page],
    queryFn: () => productService.getAll({ page, limit }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  });

  const createMutation = useMutation({
    mutationFn: productService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created successfully');
      setIsModalOpen(false);
      reset();
    },
    onError: () => {
      toast.error('Failed to create product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductForm> }) =>
      productService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated successfully');
      setIsModalOpen(false);
      setEditingId(null);
      reset();
    },
    onError: () => {
      toast.error('Failed to update product');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: productService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.success('Product deleted successfully');
    },
    onError: () => {
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.error('Failed to delete product');
    },
  });

  const onSubmit = (formData: ProductForm) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (productId: string) => {
    const product = data?.products?.find((p) => p.id === productId);
    if (product) {
      setEditingId(product.id);
      reset({
        name: product.name,
        description: product.description || '',
        category: product.category || '',
      });
      setIsModalOpen(true);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    reset({ name: '', description: '', category: '' });
    setIsModalOpen(true);
  };

  const handleDelete = (productId: string) => {
    setDeletingId(productId);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const handleFormClose = () => {
    setIsModalOpen(false);
    setEditingId(null);
    reset();
  };

  const exportToExcel = async () => {
    try {
      toast.info('Exporting products...');

      // Fetch all products (without pagination)
      const allProducts = await productService.getAll({ page: 1, limit: 10000 });
      const productsData = allProducts.products || [];

      if (!productsData || productsData.length === 0) {
        toast.error('No products to export');
        return;
      }

      // Create data for Excel
      const excelData = productsData.map((product) => ({
        'Name': product.name,
        'Category': product.category || '-',
        'Description': product.description || '-',
        'Status': product.is_active ? 'Active' : 'Inactive',
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');

      // Auto-size columns
      const maxWidth = excelData.reduce((w: any, r: any) => {
        return Object.keys(r).map((k, i) => Math.max(w[i] || 10, String(r[k]).length));
      }, []);
      ws['!cols'] = maxWidth.map((w: number) => ({ wch: w + 2 }));

      // Download
      XLSX.writeFile(wb, `products-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success(`${productsData.length} products exported successfully`);
    } catch (error) {
      toast.error('Failed to export products');
    }
  };

  const products = data?.products || [];

  return (
    <LayoutNew breadcrumbs={[{ label: 'Products' }]}>
      <div className="space-y-6">
        <PageHeader
          title="Products"
          description="Manage product information"
          actions={[
            {
              label: 'Export Excel',
              icon: Download,
              variant: 'outline',
              onClick: exportToExcel,
            },
            {
              label: 'New Product',
              icon: Plus,
              variant: 'default',
              onClick: handleAdd,
            },
          ]}
        />

        {/* Filters Button */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Filter Panel (placeholder for future enhancement) */}
        {showFilters && (
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Filter options will be available here
            </p>
          </div>
        )}

        <DataTable
          title="All Products"
          description={`${data?.pagination?.total || 0} total products`}
          columns={[
            {
              header: 'Name',
              accessor: 'name',
              cell: (row) => <span className="font-medium">{row.name}</span>,
            },
            {
              header: 'Category',
              accessor: 'category',
              cell: (row) => row.category || '-',
            },
            {
              header: 'Description',
              accessor: 'description',
              cell: (row) => row.description || '-',
            },
            {
              header: 'Status',
              accessor: 'is_active',
              cell: (row) => (
                <StatusBadge
                  status={row.is_active ? 'ACTIVE' : 'INACTIVE'}
                />
              ),
            },
          ]}
          data={products}
          rowId="id"
          rowActions={[
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
          ]}
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
        />
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={handleFormClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Product name"
                className="mt-1"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="category">Category (Optional)</Label>
              <Input
                id="category"
                {...register('category')}
                placeholder="e.g., Growth Enhancer"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                {...register('description')}
                rows={3}
                placeholder="Product description"
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleFormClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editingId
                  ? 'Update'
                  : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </LayoutNew>
  );
}
