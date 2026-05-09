import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Download, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { productService } from '../services/product.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { PermissionGuard } from '../components/PermissionGuard';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { DataTableColumn, RowAction } from '@/components/ui/data-table';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function ProductsPageNew() {
  useBreadcrumbs([{ label: 'Products' }]);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [categoryOpen, setCategoryOpen] = useState(false);

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };
  const [categorySearch, setCategorySearch] = useState('');
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
    queryKey: ['products', page, search, sortBy, sortOrder],
    queryFn: () => productService.getAll({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: productService.getCategories,
  });

  const categories = categoriesData || [];

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: productService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setIsModalOpen(false);
      form.reset();
      toast.success('Product created successfully');
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
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setIsModalOpen(false);
      setEditingId(null);
      form.reset();
      toast.success('Product updated successfully');
    },
    onError: () => {
      toast.error('Failed to update product');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: productService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeletingId(null);
      toast.success('Product deleted successfully');
    },
    onError: () => {
      setDeletingId(null);
      toast.error('Failed to delete product');
    },
  });

  const onSubmit = (data: ProductForm) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (productId: string) => {
    const product = products.find((p: any) => p.id === productId);
    if (product) {
      setEditingId(productId);
      form.reset({
        name: product.name,
        description: product.description || '',
        category: product.category || '',
      });
      setIsModalOpen(true);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    form.reset({ name: '', description: '', category: '' });
    setIsModalOpen(true);
  };

  const handleDelete = (productId: string) => {
    setDeletingId(productId);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const exportToExcel = useCallback(() => {
    if (!data?.products?.length) return;
    const ws = XLSX.utils.json_to_sheet(
      data.products.map((p: any) => ({
        Name: p.name,
        Description: p.description || '',
        Category: p.category || '',
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'products.xlsx');
    toast.success('Exported successfully');
  }, [data]);

  const products = (data as any)?.products || [];

  const columns: DataTableColumn[] = [
    { header: 'Name', accessor: 'name', sortKey: 'name', cellClassName: 'font-medium' },
    {
      header: 'Description',
      accessor: 'description',
      cell: (row: any) => (
        <span className="max-w-md truncate block">{row.description || '-'}</span>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      sortKey: 'category',
      cell: (row: any) => row.category || '-',
    },
    {
      header: 'Activity',
      accessor: 'created_at',
      sortKey: 'created_at',
      cell: (row: any) => (
        <div className="text-xs space-y-0.5">
          <div><span className="font-medium">{row.creator?.name || '-'}</span> <span className="text-muted-foreground">{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</span></div>
          {row.updater && <div className="text-muted-foreground">edited by <span className="font-medium text-foreground">{row.updater.name}</span></div>}
        </div>
      ),
    },
  ];

  const rowActions: RowAction[] = [
    { type: 'edit', label: 'Edit', onClick: handleEdit },
    { type: 'delete', label: 'Delete', onClick: handleDelete, destructive: true },
  ];

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage products used in crop trials"
        actions={
          <>
            <PermissionGuard permission="products:view">
              <Button variant="outline" onClick={exportToExcel} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="products:manage">
              <Button onClick={handleAdd} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </PermissionGuard>
          </>
        }
      />

      <DataTable
        title="All Products"
        description={`${data?.pagination?.total || 0} total products`}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        columns={columns}
        data={products}
        rowId="id"
        rowActions={rowActions}
        pagination={data?.pagination}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No products found"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by name, description, or category..."
        onPrimaryColumnClick={(id) => handleEdit(id)}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update product information'
                : 'Add a new product to the system'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Product name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Product description"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Category (Optional)</FormLabel>
                    <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={categoryOpen}
                            className={cn(
                              'justify-between font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value || 'Select or type category...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput
                            placeholder="Search or type new category..."
                            value={categorySearch}
                            onValueChange={setCategorySearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-2 text-center text-sm">
                                Press Enter to add &quot;{categorySearch}&quot;
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {categories.map((category) => (
                                <CommandItem
                                  key={category}
                                  value={category}
                                  onSelect={(value) => {
                                    field.onChange(value);
                                    setCategoryOpen(false);
                                    setCategorySearch('');
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      field.value === category ? 'opacity-100' : 'opacity-0'
                                    )}
                                  />
                                  {category}
                                </CommandItem>
                              ))}
                              {categorySearch &&
                                !categories.some(
                                  (c) => c.toLowerCase() === categorySearch.toLowerCase()
                                ) && (
                                  <CommandItem
                                    value={categorySearch}
                                    onSelect={(value) => {
                                      field.onChange(value);
                                      setCategoryOpen(false);
                                      setCategorySearch('');
                                    }}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add &quot;{categorySearch}&quot;
                                  </CommandItem>
                                )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
        variant="destructive"
      />
    </>
  );
}
