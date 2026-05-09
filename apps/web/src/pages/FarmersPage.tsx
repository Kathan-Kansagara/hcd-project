import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MoreVertical, Eye, Trash, Pencil, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { farmerService } from '../services/farmer.service';
import LayoutNew from '../components/layout/LayoutNew';
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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

export default function FarmersPage() {
  const queryClient = useQueryClient();
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingFarmerId, setEditingFarmerId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['farmers', page],
    queryFn: () => farmerService.getAll({ page, limit }),
  });

  const deleteMutation = useMutation({
    mutationFn: farmerService.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.success('Farmer archived successfully');
    },
    onError: () => {
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.error('Failed to archive farmer');
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
        'Taluka': farmer.taluka || '-',
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
    <LayoutNew breadcrumbs={[{ label: 'Farmers' }]}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Farmers</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage farmer information and contacts</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={exportToExcel} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button onClick={() => {
            setEditingFarmerId(null);
            setIsFormModalOpen(true);
          }} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Farmer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Farmers</CardTitle>
          <CardDescription>
            {data?.pagination?.total || 0} total farmers
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Village</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {farmers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No farmers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    farmers.map((farmer: any) => (
                      <TableRow key={farmer.id}>
                        <TableCell className="font-medium">{farmer.name}</TableCell>
                        <TableCell>{farmer.village || '-'}</TableCell>
                        <TableCell>{farmer.city || '-'}</TableCell>
                        <TableCell>{farmer.district || '-'}</TableCell>
                        <TableCell>{farmer.state || '-'}</TableCell>
                        <TableCell>{farmer.contact || '-'}</TableCell>
                        <TableCell>
                          {farmer.created_at ? format(new Date(farmer.created_at), 'MMM dd, yyyy') : '-'}
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
                              <DropdownMenuItem onClick={() => handleViewDetails(farmer.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(farmer.id)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(farmer.id)}
                                className="text-destructive"
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Archive
                              </DropdownMenuItem>
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
            <DialogTitle>Confirm Archive</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this farmer? This action can be undone later.
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
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LayoutNew>
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
    { label: 'Taluka', value: farmer.taluka || '-' },
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
