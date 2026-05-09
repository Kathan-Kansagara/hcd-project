import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, MoreVertical, Edit, Trash, Check, ChevronsUpDown, CalendarIcon, Package, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { batchService } from '../services/batch.service';
import { productService } from '../services/product.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import BatchFilters from '../components/batches/BatchFilters';
import type { BatchFilterValues } from '../components/batches/BatchFilters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { PermissionGuard } from '@/components/PermissionGuard';

const batchSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  batch_number: z.string().min(1, 'Batch number is required'),
  manufacturing_date: z.date(),
  expiry_date: z.date(),
  quantity_produced: z.number().positive('Quantity must be positive'),
  unit: z.enum(['LITER', 'KG', 'PIECE']),
  storage_location: z.string().optional(),
  notes: z.string().optional(),
});

type BatchForm = z.infer<typeof batchSchema>;

export default function BatchesPageNew() {
  useBreadcrumbs([{ label: 'Batches' }]);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [productOpen, setProductOpen] = useState(false);
  const [mfgDateOpen, setMfgDateOpen] = useState(false);
  const [expDateOpen, setExpDateOpen] = useState(false);
  const [filters, setFilters] = useState<BatchFilterValues>({});
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['batches', page, filters],
    queryFn: () => batchService.getAll({ page, limit, ...filters }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => productService.getAll({ page: 1, limit: 1000 }),
  });

  const products = (productsData as any)?.products || [];

  const form = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      product_id: '',
      batch_number: '',
      manufacturing_date: new Date(),
      expiry_date: new Date(),
      quantity_produced: 0,
      unit: 'LITER',
      storage_location: '',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: batchService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsModalOpen(false);
      form.reset();
      toast.success('Batch created successfully');
    },
    onError: () => {
      toast.error('Failed to create batch');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BatchForm> }) =>
      batchService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsModalOpen(false);
      setEditingId(null);
      form.reset();
      toast.success('Batch updated successfully');
    },
    onError: () => {
      toast.error('Failed to update batch');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: batchService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.success('Batch deleted successfully');
    },
    onError: () => {
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.error('Failed to delete batch');
    },
  });

  const onSubmit = (data: BatchForm) => {
    const submitData = {
      ...data,
      manufacturing_date: data.manufacturing_date.toISOString(),
      expiry_date: data.expiry_date.toISOString(),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (batch: any) => {
    setEditingId(batch.id);
    form.reset({
      product_id: batch.product_id,
      batch_number: batch.batch_number,
      manufacturing_date: new Date(batch.manufacturing_date),
      expiry_date: new Date(batch.expiry_date),
      quantity_produced: batch.quantity_produced,
      unit: batch.unit,
      storage_location: batch.storage_location || '',
      notes: batch.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    form.reset({
      product_id: '',
      batch_number: '',
      manufacturing_date: new Date(),
      expiry_date: new Date(),
      quantity_produced: 0,
      unit: 'LITER',
      storage_location: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = (batchId: string) => {
    setDeletingId(batchId);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const getExpiryBadge = (expiryStatus: string) => {
    if (expiryStatus === 'expired') {
      return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Expired</Badge>;
    } else if (expiryStatus === 'expiring_soon') {
      return <Badge className="bg-muted text-muted-foreground border-border">Expiring Soon</Badge>;
    }
    return <Badge className="bg-primary/10 text-primary border-primary/20">Active</Badge>;
  };

  const getRowClassName = (expiryStatus: string) => {
    if (expiryStatus === 'expired') {
      return 'bg-destructive/5 hover:bg-destructive/10';
    } else if (expiryStatus === 'expiring_soon') {
      return 'bg-muted/30 hover:bg-muted/50';
    }
    return '';
  };

  const batches = (data as any)?.batches || [];

  const handleFilterChange = (newFilters: BatchFilterValues) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const exportToExcel = async () => {
    try {
      toast.info('Exporting batches...');

      // Fetch all batches matching current filters (without pagination)
      const allBatches = await batchService.getAll({ page: 1, limit: 10000, ...filters });
      const batchesData = (allBatches as any)?.batches || [];

      if (!batchesData || batchesData.length === 0) {
        toast.error('No batches to export');
        return;
      }

      // Create data for Excel
      const data = batchesData.map((batch: any) => ({
        'Batch Number': batch.batch_number,
        'Product': batch.product?.name || '-',
        'Stock': `${batch.quantity_remaining} / ${batch.quantity_produced} ${batch.unit}`,
        'Expiry Date': format(new Date(batch.expiry_date), 'MMM dd, yyyy'),
        'Status': batch.expiry_status === 'expired' ? 'Expired' : batch.expiry_status === 'expiring_soon' ? 'Expiring Soon' : 'Active'
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Batches');

      // Auto-size columns
      const maxWidth = data.reduce((w: any, r: any) => {
        return Object.keys(r).map((k, i) => Math.max(w[i] || 10, String(r[k]).length));
      }, []);
      ws['!cols'] = maxWidth.map((w: number) => ({ wch: w + 2 }));

      // Download
      XLSX.writeFile(wb, `batches-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success(`${batchesData.length} batches exported successfully`);
    } catch (error) {
      toast.error('Failed to export batches');
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Product Batches</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track batch inventory and expiry dates
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <PermissionGuard permission="batches:view">
            <Button variant="outline" onClick={exportToExcel} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="batches:manage">
            <Button onClick={handleAdd} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Batch
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Filters */}
      <BatchFilters
        onFilterChange={handleFilterChange}
        initialFilters={filters}
        products={products}
      />

      <Card>
        <CardHeader>
          <CardTitle>Batch Inventory</CardTitle>
          <CardDescription>Manage product batches and stock levels</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No batches found
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((batch: any) => (
                      <TableRow key={batch.id} className={getRowClassName(batch.expiry_status)}>
                        <TableCell className="font-medium">{batch.batch_number}</TableCell>
                        <TableCell>{batch.product?.name || '-'}</TableCell>
                        <TableCell>
                          {batch.quantity_remaining} / {batch.quantity_produced} {batch.unit}
                        </TableCell>
                        <TableCell>{format(new Date(batch.expiry_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{getExpiryBadge(batch.expiry_status)}</TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <div><span className="font-medium">{batch.creator?.name || '-'}</span></div>
                            {batch.updater && <div className="text-muted-foreground">edited by <span className="font-medium text-foreground">{batch.updater.name}</span></div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <PermissionGuard permission="batches:manage">
                                <DropdownMenuItem onClick={() => handleEdit(batch)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              </PermissionGuard>
                              <PermissionGuard permission="batches:manage">
                                <DropdownMenuItem
                                  onClick={() => handleDelete(batch.id)}
                                  className="text-destructive"
                                >
                                  <Trash className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </PermissionGuard>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {data?.pagination && (
            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={data.pagination.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Batch' : 'Add Batch'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update batch information' : 'Add a new product batch'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Product</FormLabel>
                    <Popover open={productOpen} onOpenChange={setProductOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={productOpen}
                            className={cn(
                              'justify-between font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value
                              ? products.find((p: any) => p.id === field.value)?.name
                              : 'Select product...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput placeholder="Search products..." />
                          <CommandList>
                            <CommandEmpty>No product found.</CommandEmpty>
                            <CommandGroup>
                              {products.map((product: any) => (
                                <CommandItem
                                  key={product.id}
                                  value={product.id}
                                  onSelect={() => {
                                    field.onChange(product.id);
                                    setProductOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      field.value === product.id ? 'opacity-100' : 'opacity-0'
                                    )}
                                  />
                                  <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                                  {product.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="batch_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., BATCH-2025-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="manufacturing_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Manufacturing Date</FormLabel>
                      <Popover open={mfgDateOpen} onOpenChange={setMfgDateOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              setMfgDateOpen(false);
                            }}
                            disabled={(date) => date > new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiry_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expiry Date</FormLabel>
                      <Popover open={expDateOpen} onOpenChange={setExpDateOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              setExpDateOpen(false);
                            }}
                            disabled={(date) => date < new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity_produced"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity Produced</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 100"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
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
                      <FormLabel>Unit</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="LITER">Liter</SelectItem>
                          <SelectItem value="KG">Kilogram</SelectItem>
                          <SelectItem value="BAG">Bag</SelectItem>
                          <SelectItem value="BOTTLE">Bottle</SelectItem>
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
                    <FormLabel>Storage Location (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Warehouse A, Shelf 3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about this batch"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
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

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this batch? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsConfirmOpen(false);
                setDeletingId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
