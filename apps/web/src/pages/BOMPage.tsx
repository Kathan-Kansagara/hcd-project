import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Eye, Pencil, Trash2, Package, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { bomService } from '../services/bom.service';
import { productService } from '../services/product.service';
import { rawMaterialService } from '../services/raw-material.service';
import type { BOMItem, ProductBOMSummary } from '../services/bom.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const UNITS = ['LITER', 'KG', 'PIECE'];

// ── Types ──────────────────────────────────────────────

interface EditableRow {
  id: string; // BOM item ID (existing) or temp UUID (new)
  raw_material_id: string;
  quantity_per_unit: number | '';
  unit: string;
  notes: string;
  isNew?: boolean; // true for newly added rows not yet saved
}

interface BulkAddRow {
  id: string;
  raw_material_id: string;
  quantity_per_unit: number | '';
  unit: string;
  notes: string;
}

const createEmptyRow = (): BulkAddRow => ({
  id: crypto.randomUUID(),
  raw_material_id: '',
  quantity_per_unit: '',
  unit: '',
  notes: '',
});

// ── Component ──────────────────────────────────────────

export default function BOMPage() {
  useBreadcrumbs([{ label: 'Bill of Materials' }]);
  const queryClient = useQueryClient();

  // Main table state
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // View sheet state
  const [viewProductId, setViewProductId] = useState<string | null>(null);
  const [viewProductName, setViewProductName] = useState('');

  // Edit sheet state
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editProductName, setEditProductName] = useState('');
  const [editRows, setEditRows] = useState<EditableRow[]>([]);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Bulk add (new product recipe) dialog state
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [bulkProductId, setBulkProductId] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkAddRow[]>([createEmptyRow()]);
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});

  // Delete confirm state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deletingProductName, setDeletingProductName] = useState('');

  // ── Data queries ──

  const { data, isLoading } = useQuery({
    queryKey: ['bom-products', page, search],
    queryFn: () => bomService.getProductsWithBOM({ page, limit, search: search || undefined }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productService.getAll({ page: 1, limit: 1000 }),
  });

  const { data: rawMaterialsData } = useQuery({
    queryKey: ['raw-materials-all'],
    queryFn: () => rawMaterialService.getAll({ page: 1, limit: 1000 }),
  });

  // View: fetch BOM items for selected product
  const { data: viewBomData, isLoading: viewLoading } = useQuery({
    queryKey: ['bom-by-product', viewProductId],
    queryFn: () => bomService.getByProduct(viewProductId!),
    enabled: !!viewProductId,
  });

  // Fetch existing BOM for the product selected in bulk add dialog
  const { data: existingBomForBulkProduct } = useQuery({
    queryKey: ['bom-by-product', bulkProductId],
    queryFn: () => bomService.getByProduct(bulkProductId),
    enabled: !!bulkProductId && isBulkAddOpen,
  });

  const products = productsData?.products || [];
  const rawMaterials = rawMaterialsData?.raw_materials || [];

  const existingRmIdsForBulk = new Set(
    existingBomForBulkProduct?.bom_items?.map((item: BOMItem) => item.raw_material_id) || []
  );

  // ── Mutations ──

  const bulkCreateMutation = useMutation({
    mutationFn: bomService.bulkCreate,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bom-products'] });
      queryClient.invalidateQueries({ queryKey: ['bom-by-product'] });
      toast.success(`${result.count} raw material(s) added to recipe`);
      closeBulkAdd();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add BOM items');
    },
  });

  const deleteProductBOMMutation = useMutation({
    mutationFn: bomService.deleteProductBOM,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bom-products'] });
      queryClient.invalidateQueries({ queryKey: ['bom-by-product'] });
      toast.success(result.message);
      setIsConfirmOpen(false);
      setDeletingProductId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete recipe');
      setIsConfirmOpen(false);
    },
  });

  const deleteSingleMutation = useMutation({
    mutationFn: bomService.delete,
  });

  const updateSingleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BOMItem> }) =>
      bomService.update(id, data),
  });

  // ── View handlers ──

  const handleView = (productId: string, productName: string) => {
    setViewProductId(productId);
    setViewProductName(productName);
  };

  // ── Edit handlers ──

  const handleEdit = async (productId: string, productName: string) => {
    try {
      const data = await bomService.getByProduct(productId);
      setEditProductId(productId);
      setEditProductName(productName);
      setEditRows(
        data.bom_items.map((item: any) => ({
          id: item.id,
          raw_material_id: item.raw_material_id,
          quantity_per_unit: item.quantity_per_unit,
          unit: item.unit,
          notes: item.notes || '',
          isNew: false,
        }))
      );
      setEditErrors({});
    } catch {
      toast.error('Failed to load recipe data');
    }
  };

  const addEditRow = useCallback(() => {
    setEditRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        raw_material_id: '',
        quantity_per_unit: '',
        unit: '',
        notes: '',
        isNew: true,
      },
    ]);
  }, []);

  const removeEditRow = useCallback((rowId: string) => {
    setEditRows((prev) => prev.filter((r) => r.id !== rowId));
    setEditErrors((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, []);

  const updateEditRow = useCallback((rowId: string, field: keyof EditableRow, value: any) => {
    setEditRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
    );
    setEditErrors((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, []);

  const handleEditRmSelect = useCallback(
    (rowId: string, rmId: string) => {
      const selectedMaterial = rawMaterials.find((rm: any) => rm.id === rmId);
      setEditRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, raw_material_id: rmId, unit: selectedMaterial?.unit || r.unit }
            : r
        )
      );
      setEditErrors((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    },
    [rawMaterials]
  );

  const validateEditForm = (): boolean => {
    const errors: Record<string, string> = {};
    const seenRmIds = new Set<string>();

    if (editRows.length === 0) {
      toast.error('Recipe must have at least one raw material. Use "Delete Recipe" to remove the entire recipe.');
      return false;
    }

    for (const row of editRows) {
      if (!row.raw_material_id) {
        errors[row.id] = 'Select a raw material';
      } else if (seenRmIds.has(row.raw_material_id)) {
        errors[row.id] = 'Duplicate raw material';
      } else if (!row.quantity_per_unit || Number(row.quantity_per_unit) <= 0) {
        errors[row.id] = 'Quantity must be greater than 0';
      } else if (!row.unit) {
        errors[row.id] = 'Unit is required';
      }
      if (row.raw_material_id) seenRmIds.add(row.raw_material_id);
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSave = async () => {
    if (!validateEditForm() || !editProductId) return;

    setSavingEdit(true);
    try {
      // Fetch current state from server
      const currentData = await bomService.getByProduct(editProductId);
      const currentItems = currentData.bom_items;
      const currentIds = new Set(currentItems.map((item: BOMItem) => item.id));

      const existingRows = editRows.filter((r) => !r.isNew);
      const newRows = editRows.filter((r) => r.isNew && r.raw_material_id);

      // Items to delete: in current but not in edit rows
      const editRowIds = new Set(existingRows.map((r) => r.id));
      const toDelete = currentItems.filter((item: BOMItem) => !editRowIds.has(item.id));

      // Items to update: existing rows that still exist on server
      const toUpdate = existingRows.filter((r) => currentIds.has(r.id));

      // Execute all operations
      const promises: Promise<any>[] = [];

      // Delete removed items
      for (const item of toDelete) {
        promises.push(deleteSingleMutation.mutateAsync(item.id));
      }

      // Update existing items
      for (const row of toUpdate) {
        promises.push(
          updateSingleMutation.mutateAsync({
            id: row.id,
            data: {
              quantity_per_unit: Number(row.quantity_per_unit),
              unit: row.unit,
              notes: row.notes || undefined,
            },
          })
        );
      }

      await Promise.all(promises);

      // Bulk create new items
      if (newRows.length > 0) {
        await bomService.bulkCreate({
          product_id: editProductId,
          items: newRows.map((r) => ({
            raw_material_id: r.raw_material_id,
            quantity_per_unit: Number(r.quantity_per_unit),
            unit: r.unit,
            notes: r.notes || undefined,
          })),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['bom-products'] });
      queryClient.invalidateQueries({ queryKey: ['bom-by-product'] });
      toast.success('Recipe updated successfully');
      setEditProductId(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save recipe changes');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Delete handlers ──

  const handleDeleteRecipe = (productId: string, productName: string) => {
    setDeletingProductId(productId);
    setDeletingProductName(productName);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deletingProductId) {
      deleteProductBOMMutation.mutate(deletingProductId);
    }
  };

  // ── Bulk Add (new recipe) handlers ──

  const openBulkAdd = () => {
    setBulkProductId('');
    setBulkRows([createEmptyRow()]);
    setBulkErrors({});
    setIsBulkAddOpen(true);
  };

  const closeBulkAdd = () => {
    setIsBulkAddOpen(false);
    setBulkProductId('');
    setBulkRows([createEmptyRow()]);
    setBulkErrors({});
  };

  const addBulkRow = useCallback(() => {
    setBulkRows((prev) => [...prev, createEmptyRow()]);
  }, []);

  const removeBulkRow = useCallback((rowId: string) => {
    setBulkRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== rowId)));
    setBulkErrors((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, []);

  const updateBulkRow = useCallback((rowId: string, field: keyof BulkAddRow, value: any) => {
    setBulkRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
    );
    setBulkErrors((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, []);

  const handleBulkRmSelect = useCallback(
    (rowId: string, rmId: string) => {
      const selectedMaterial = rawMaterials.find((rm: any) => rm.id === rmId);
      setBulkRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, raw_material_id: rmId, unit: selectedMaterial?.unit || r.unit }
            : r
        )
      );
      setBulkErrors((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    },
    [rawMaterials]
  );

  const validateBulkForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!bulkProductId) {
      toast.error('Please select a product first');
      return false;
    }
    const seenRmIds = new Set<string>();
    for (const row of bulkRows) {
      if (!row.raw_material_id) {
        errors[row.id] = 'Select a raw material';
      } else if (existingRmIdsForBulk.has(row.raw_material_id)) {
        const rm = rawMaterials.find((m: any) => m.id === row.raw_material_id);
        errors[row.id] = `${rm?.name || 'This material'} is already in the BOM`;
      } else if (seenRmIds.has(row.raw_material_id)) {
        errors[row.id] = 'Duplicate raw material';
      } else if (!row.quantity_per_unit || Number(row.quantity_per_unit) <= 0) {
        errors[row.id] = 'Quantity must be greater than 0';
      } else if (!row.unit) {
        errors[row.id] = 'Unit is required';
      }
      if (row.raw_material_id) seenRmIds.add(row.raw_material_id);
    }
    setBulkErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBulkSubmit = () => {
    if (!validateBulkForm()) return;
    bulkCreateMutation.mutate({
      product_id: bulkProductId,
      items: bulkRows.map((r) => ({
        raw_material_id: r.raw_material_id,
        quantity_per_unit: Number(r.quantity_per_unit),
        unit: r.unit,
        notes: r.notes || undefined,
      })),
    });
  };

  // ── Export ──

  const exportToExcel = async () => {
    try {
      toast.info('Exporting BOM items...');
      const allData = await bomService.getAll({ page: 1, limit: 10000 });
      const bomItems = allData.bom_items || [];
      if (!bomItems.length) {
        toast.error('No BOM items to export');
        return;
      }
      const exportData = bomItems.map((item) => ({
        'Product': item.product?.name || '-',
        'Product Category': item.product?.category || '-',
        'Raw Material Code': item.raw_material?.code || '-',
        'Raw Material Name': item.raw_material?.name || '-',
        'RM Category': item.raw_material?.category || '-',
        'Quantity per Unit': item.quantity_per_unit,
        'Unit': item.unit,
        'Notes': item.notes || '-',
        'Created At': item.created_at ? format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss') : '-',
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM Items');
      const maxWidth = exportData.reduce((w: any, r: any) => {
        return Object.keys(r).map((k, i) => Math.max(w[i] || 10, String(r[k]).length));
      }, []);
      worksheet['!cols'] = maxWidth.map((w: number) => ({ wch: w + 2 }));
      const fileName = `bom_items_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`${bomItems.length} BOM items exported`);
    } catch {
      toast.error('Failed to export BOM items');
    }
  };

  // ── Options ──

  const productOptions = products.map((p: any) => ({
    value: p.id,
    label: p.name,
  }));

  const rawMaterialOptions = rawMaterials.map((rm: any) => ({
    value: rm.id,
    label: `${rm.code} - ${rm.name}`,
  }));

  const getRmOptionsForBulk = (currentRmId: string) => {
    const selectedInOtherRows = new Set(
      bulkRows
        .filter((r) => r.raw_material_id && r.raw_material_id !== currentRmId)
        .map((r) => r.raw_material_id)
    );
    return rawMaterials.map((rm: any) => {
      const isExisting = existingRmIdsForBulk.has(rm.id);
      const isSelected = selectedInOtherRows.has(rm.id);
      return {
        value: rm.id,
        label: `${rm.code} - ${rm.name}${isExisting ? ' (already in BOM)' : ''}${isSelected ? ' (selected above)' : ''}`,
      };
    });
  };

  const getRmOptionsForEdit = (currentRmId: string) => {
    const selectedInOtherRows = new Set(
      editRows
        .filter((r) => r.raw_material_id && r.raw_material_id !== currentRmId)
        .map((r) => r.raw_material_id)
    );
    return rawMaterials.map((rm: any) => ({
      value: rm.id,
      label: `${rm.code} - ${rm.name}${selectedInOtherRows.has(rm.id) ? ' (already used)' : ''}`,
    }));
  };

  const getRmName = (rmId: string) => {
    const rm = rawMaterials.find((m: any) => m.id === rmId);
    return rm ? `${rm.code} - ${rm.name}` : rmId;
  };

  // ── Table columns (product-centric) ──

  const columns = [
    {
      header: 'Product',
      accessor: 'product_name',
      cell: (row: ProductBOMSummary) => (
        <div>
          <div className="font-medium">{row.product_name}</div>
          {row.product_category && (
            <div className="text-sm text-muted-foreground">{row.product_category}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Materials',
      accessor: 'material_count',
      cell: (row: ProductBOMSummary) => (
        <Badge variant="secondary" className="font-mono">
          {row.material_count} material{row.material_count !== 1 ? 's' : ''}
        </Badge>
      ),
    },
    {
      header: 'Categories',
      accessor: 'categories',
      cell: (row: ProductBOMSummary) => (
        <div className="flex flex-wrap gap-1">
          {row.categories.slice(0, 3).map((cat) => (
            <Badge key={cat} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              {cat.replace(/_/g, ' ')}
            </Badge>
          ))}
          {row.categories.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{row.categories.length - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Last Updated',
      accessor: 'last_updated',
      cell: (row: ProductBOMSummary) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.last_updated), 'dd MMM yyyy')}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Bill of Materials (BOM)"
          description="Define product recipes and raw material requirements"
          actions={[
            {
              label: 'Export Excel',
              icon: Download,
              variant: 'outline',
              onClick: exportToExcel,
            },
            {
              label: 'Add Recipe',
              icon: Plus,
              variant: 'default',
              onClick: openBulkAdd,
            },
          ]}
        />

        <DataTable
          title="Product Recipes"
          description={`${data?.pagination?.total || 0} product(s) with defined recipes`}
          columns={columns}
          data={data?.products || []}
          rowId="product_id"
          rowActions={[
            {
              type: 'view' as any,
              label: 'View Recipe',
              onClick: (id: string) => {
                const product = data?.products?.find((p) => p.product_id === id);
                handleView(id, product?.product_name || '');
              },
              icon: Eye,
            },
            {
              type: 'edit',
              label: 'Edit Recipe',
              onClick: (id: string) => {
                const product = data?.products?.find((p) => p.product_id === id);
                handleEdit(id, product?.product_name || '');
              },
              icon: Pencil,
            },
            {
              type: 'delete',
              label: 'Delete Recipe',
              onClick: (id: string) => {
                const product = data?.products?.find((p) => p.product_id === id);
                handleDeleteRecipe(id, product?.product_name || '');
              },
              destructive: true,
              icon: Trash2,
            },
          ]}
          pagination={data?.pagination}
          onPageChange={setPage}
          loading={isLoading}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search by product name..."
          onRowClick={(id) => {
            const product = data?.products?.find((p) => p.product_id === id);
            handleView(id, product?.product_name || '');
          }}
          onPrimaryColumnClick={(id) => {
            const product = data?.products?.find((p) => p.product_id === id);
            handleEdit(id, product?.product_name || '');
          }}
        />
      </div>

      {/* ====== VIEW RECIPE SHEET ====== */}
      <Sheet open={!!viewProductId} onOpenChange={(open) => !open && setViewProductId(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {viewProductName}
            </SheetTitle>
            <SheetDescription>
              Recipe - {viewBomData?.total_items || 0} raw material(s)
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {viewLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Loading recipe...
              </div>
            ) : viewBomData?.bom_items?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Raw Material</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty / Unit</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewBomData.bom_items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.raw_material?.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.raw_material?.code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          {item.raw_material?.category?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.quantity_per_unit} {item.unit}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {item.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">No raw materials in this recipe.</div>
            )}
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setViewProductId(null);
                if (viewProductId) handleEdit(viewProductId, viewProductName);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Recipe
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ====== EDIT RECIPE SHEET ====== */}
      <Sheet open={!!editProductId} onOpenChange={(open) => !open && setEditProductId(null)}>
        <SheetContent className="sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Recipe - {editProductName}
            </SheetTitle>
            <SheetDescription>
              Modify quantities, add or remove raw materials from this recipe.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_100px_90px_1fr_36px] gap-2 items-end px-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Raw Material</Label>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</Label>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit</Label>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</Label>
              <div />
            </div>

            {/* Editable rows */}
            {editRows.map((row) => (
              <Card
                key={row.id}
                className={`border ${editErrors[row.id] ? 'border-destructive' : row.isNew ? 'border-dashed border-green-400' : 'border-border'}`}
              >
                <CardContent className="p-3">
                  <div className="grid grid-cols-[1fr_100px_90px_1fr_36px] gap-2 items-start">
                    {/* Raw Material */}
                    {row.isNew ? (
                      <SearchableCombobox
                        options={getRmOptionsForEdit(row.raw_material_id)}
                        value={row.raw_material_id}
                        onChange={(val) => handleEditRmSelect(row.id, val)}
                        placeholder="Select material..."
                        label="raw material"
                      />
                    ) : (
                      <div className="flex items-center h-9 px-3 text-sm bg-muted rounded-md truncate">
                        {getRmName(row.raw_material_id)}
                      </div>
                    )}

                    {/* Quantity */}
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={row.quantity_per_unit}
                      onChange={(e) =>
                        updateEditRow(
                          row.id,
                          'quantity_per_unit',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                    />

                    {/* Unit */}
                    <Select
                      value={row.unit}
                      onValueChange={(val) => updateEditRow(row.id, 'unit', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Notes */}
                    <Input
                      placeholder="Notes..."
                      value={row.notes}
                      onChange={(e) => updateEditRow(row.id, 'notes', e.target.value)}
                    />

                    {/* Remove */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => removeEditRow(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {editErrors[row.id] && (
                    <p className="text-sm text-destructive mt-2">{editErrors[row.id]}</p>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Add row */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addEditRow}
              className="w-full border-dashed"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add raw material
            </Button>
          </div>

          <Separator className="my-6" />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditProductId(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ====== BULK ADD (NEW RECIPE) DIALOG ====== */}
      <Dialog open={isBulkAddOpen} onOpenChange={(open) => !open && closeBulkAdd()}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product Recipe</DialogTitle>
            <DialogDescription>
              Select a product and define its raw material recipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Product Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Product *</Label>
              <SearchableCombobox
                options={productOptions}
                value={bulkProductId}
                onChange={(val) => {
                  setBulkProductId(val);
                  setBulkErrors({});
                }}
                placeholder="Select a product..."
                label="product"
              />
            </div>

            {/* Existing BOM alert */}
            {bulkProductId && existingBomForBulkProduct && existingBomForBulkProduct.bom_items?.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This product already has{' '}
                  <strong>{existingBomForBulkProduct.bom_items.length}</strong> raw material(s).
                  New materials will be added to the existing recipe.
                </AlertDescription>
              </Alert>
            )}

            {bulkProductId && (
              <>
                <Separator />

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_120px_100px_1fr_40px] gap-3 items-end px-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Raw Material *</Label>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty / Unit *</Label>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit *</Label>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</Label>
                  <div />
                </div>

                {/* Dynamic rows */}
                <div className="space-y-3">
                  {bulkRows.map((row) => (
                    <Card
                      key={row.id}
                      className={`border ${bulkErrors[row.id] ? 'border-destructive' : 'border-border'}`}
                    >
                      <CardContent className="p-3">
                        <div className="grid grid-cols-[1fr_120px_100px_1fr_40px] gap-3 items-start">
                          <div className="min-w-0">
                            <SearchableCombobox
                              options={getRmOptionsForBulk(row.raw_material_id)}
                              value={row.raw_material_id}
                              onChange={(val) => handleBulkRmSelect(row.id, val)}
                              placeholder="Select material..."
                              label="raw material"
                            />
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={row.quantity_per_unit}
                            onChange={(e) =>
                              updateBulkRow(
                                row.id,
                                'quantity_per_unit',
                                e.target.value === '' ? '' : Number(e.target.value)
                              )
                            }
                          />
                          <Select
                            value={row.unit}
                            onValueChange={(val) => updateBulkRow(row.id, 'unit', val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="min-w-0">
                            <Input
                              placeholder="Optional notes..."
                              value={row.notes}
                              onChange={(e) => updateBulkRow(row.id, 'notes', e.target.value)}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => removeBulkRow(row.id)}
                            disabled={bulkRows.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {bulkErrors[row.id] && (
                          <p className="text-sm text-destructive mt-2">{bulkErrors[row.id]}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBulkRow}
                  className="w-full border-dashed"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add another raw material
                </Button>
              </>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={closeBulkAdd} disabled={bulkCreateMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={!bulkProductId || bulkCreateMutation.isPending}
            >
              {bulkCreateMutation.isPending
                ? 'Saving...'
                : `Add ${bulkRows.filter((r) => r.raw_material_id).length} Item(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== DELETE CONFIRM ====== */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setDeletingProductId(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Entire Recipe"
        message={`Are you sure you want to delete the entire BOM recipe for "${deletingProductName}"? All raw material entries for this product will be removed. This action cannot be undone.`}
        confirmLabel="Delete Recipe"
        variant="destructive"
        loading={deleteProductBOMMutation.isPending}
      />
    </>
  );
}
