import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash, Pencil, Download, Search, ArchiveRestore } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { farmerService } from '../services/farmer.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { PermissionGuard } from '../components/PermissionGuard';
import { usePermissions } from '../hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import FarmerFormDialog from '../components/FarmerFormDialog';

export default function FarmersPageNew() {
  useBreadcrumbs([{ label: 'Farmers' }]);
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingFarmerId, setEditingFarmerId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['farmers', page, search, showArchived, sortBy, sortOrder],
    queryFn: () => farmerService.getAll({ page, limit, search, include_archived: showArchived, sortBy, sortOrder }),
  });

  const deleteMutation = useMutation({
    mutationFn: farmerService.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.success('Farmer deleted successfully');
    },
    onError: () => {
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.error('Failed to delete farmer');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: farmerService.unarchive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      toast.success('Farmer restored successfully');
    },
    onError: () => {
      toast.error('Failed to restore farmer');
    },
  });

  const farmers = (data as any)?.farmers || [];

  const handleViewDetails = (farmerId: string) => {
    setSelectedFarmerId(farmerId);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (farmerId: string) => {
    setEditingFarmerId(farmerId);
    setIsFormModalOpen(true);
  };

  const handleDelete = (farmerId: string) => {
    setDeletingId(farmerId);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const handleRestore = (farmerId: string) => {
    restoreMutation.mutate(farmerId);
  };

  const exportToExcel = async () => {
    try {
      toast.info('Exporting farmers...');

      // Fetch all farmers (without pagination)
      const allFarmers = await farmerService.getAll({ page: 1, limit: 10000 });
      const farmersData = (allFarmers as any)?.farmers || [];

      if (!farmersData || farmersData.length === 0) {
        toast.error('No farmers to export');
        return;
      }

      // Create data for Excel
      const exportData = farmersData.map((farmer: any) => ({
        'Name': farmer.name,
        'Village': farmer.village || '-',
        'City': farmer.city || '-',
        'District': farmer.district || '-',
        'State': farmer.state || '-',
        'Pincode': farmer.pincode || '-',
        'Contact': farmer.contact || '-',
        'Created At': farmer.created_at ? format(new Date(farmer.created_at), 'MMM dd, yyyy') : '-',
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Farmers');

      // Auto-size columns
      const maxWidth = exportData.reduce((w: any, r: any) => {
        return Object.keys(r).map((k, i) => Math.max(w[i] || 10, String(r[k]).length));
      }, []);
      ws['!cols'] = maxWidth.map((w: number) => ({ wch: w + 2 }));

      // Download
      XLSX.writeFile(wb, `farmers-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success(`${farmersData.length} farmers exported successfully`);
    } catch (error) {
      toast.error('Failed to export farmers');
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Farmers</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage farmer information and contacts</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <PermissionGuard permission="farmers:view">
            <Button variant="outline" onClick={exportToExcel} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="farmers:manage">
            <Button onClick={() => {
              setEditingFarmerId(null);
              setIsFormModalOpen(true);
            }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Farmer
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardDescription>
            {data?.pagination?.total || 0} total farmers
          </CardDescription>
          {isAdmin() && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-archived"
                checked={showArchived}
                onCheckedChange={(checked) => {
                  setShowArchived(checked === true);
                  setPage(1); // Reset to first page when toggling
                }}
              />
              <Label
                htmlFor="show-archived"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Show deleted farmers
              </Label>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search farmers by name, contact, village, city, district, state, or pincode..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <TooltipProvider delayDuration={300}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Village</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>District</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Pincode</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead className="text-right w-auto">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {farmers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No farmers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      farmers.map((farmer: any) => (
                        <TableRow
                          key={farmer.id}
                          className={`cursor-pointer hover:bg-muted/50 ${farmer.is_archived ? 'opacity-60' : ''}`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('button, a, [role="button"], [data-primary-click]')) return;
                            handleViewDetails(farmer.id);
                          }}
                        >
                          <TableCell className="font-medium">
                            <span
                              data-primary-click
                              className="cursor-pointer text-primary hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!farmer.is_archived) handleEdit(farmer.id);
                              }}
                            >
                              {farmer.name}
                            </span>
                            {farmer.is_archived && <span className="ml-2 text-xs text-muted-foreground">(Deleted)</span>}
                          </TableCell>
                          <TableCell>{farmer.contact || '-'}</TableCell>
                          <TableCell>{farmer.village || '-'}</TableCell>
                          <TableCell>{farmer.city || '-'}</TableCell>
                          <TableCell>{farmer.district || '-'}</TableCell>
                          <TableCell>{farmer.state || '-'}</TableCell>
                          <TableCell>{farmer.pincode || '-'}</TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              <div><span className="font-medium">{farmer.creator?.name || '-'}</span> <span className="text-muted-foreground">{farmer.created_at ? format(new Date(farmer.created_at), 'MMM dd, yyyy') : ''}</span></div>
                              {farmer.updater && <div className="text-muted-foreground">edited by <span className="font-medium text-foreground">{farmer.updater.name}</span></div>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <PermissionGuard permission="farmers:manage">
                              <div className="flex items-center justify-end gap-0.5">
                                {!farmer.is_archived && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEdit(farmer.id);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                        <span className="sr-only">Edit</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Edit</TooltipContent>
                                  </Tooltip>
                                )}
                                {farmer.is_archived ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRestore(farmer.id);
                                        }}
                                      >
                                        <ArchiveRestore className="h-4 w-4" />
                                        <span className="sr-only">Restore</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Restore</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(farmer.id);
                                        }}
                                      >
                                        <Trash className="h-4 w-4" />
                                        <span className="sr-only">Delete</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Delete</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </PermissionGuard>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TooltipProvider>
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

      {/* Farmer Detail Modal */}
      {selectedFarmerId && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Farmer Details</DialogTitle>
              <DialogDescription>
                View farmer information
              </DialogDescription>
            </DialogHeader>
            <FarmerDetailView farmerId={selectedFarmerId} />
          </DialogContent>
        </Dialog>
      )}

      {/* Farmer Form Modal */}
      <FarmerFormDialog
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingFarmerId(null);
        }}
        farmerId={editingFarmerId}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this farmer? This action can be undone later.
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

// Farmer Detail View Component
function FarmerDetailView({ farmerId }: { farmerId: string }) {
  const { data: farmer, isLoading } = useQuery({
    queryKey: ['farmer', farmerId],
    queryFn: () => farmerService.getById(farmerId),
  });

  if (isLoading) {
    return <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>;
  }

  if (!farmer) {
    return <div className="text-center text-muted-foreground">Farmer not found</div>;
  }

  const detailRows = [
    { label: 'Name', value: farmer.name },
    { label: 'Village', value: farmer.village || '-' },
    { label: 'City', value: farmer.city || '-' },
    { label: 'District', value: farmer.district || '-' },
    { label: 'State', value: farmer.state || '-' },
    { label: 'Pincode', value: farmer.pincode || '-' },
    { label: 'Contact', value: farmer.contact || '-' },
    { label: 'Created At', value: farmer.created_at ? format(new Date(farmer.created_at), 'PPP') : '-' },
  ];

  return (
    <div className="space-y-4">
      {detailRows.map((row) => (
        <div key={row.label} className="grid grid-cols-3 gap-4">
          <div className="font-medium text-muted-foreground">{row.label}:</div>
          <div className="col-span-2">{row.value}</div>
        </div>
      ))}
    </div>
  );
}
