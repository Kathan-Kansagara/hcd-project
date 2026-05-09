import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MoreVertical, Eye, Trash, Pencil, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { trialService } from '../services/trial.service';
import { useAuth } from '../contexts/AuthContext';
import { PermissionGuard } from '../components/PermissionGuard';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import TrialDetailModal from '../components/trials/TrialDetailModal';
import AddTrialModalNew from '../components/trials/AddTrialModalNew';
import TrialFilters from '../components/trials/TrialFilters';
import type { TrialFilterValues } from '../components/trials/TrialFilters';
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
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';

export default function TrialsPageNew() {
  useBreadcrumbs([{ label: 'Trials' }]);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTrialId, setEditingTrialId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TrialFilterValues>({});
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['trials', page, filters],
    queryFn: () => trialService.getAll({ page, limit, ...filters }),
  });

  const deleteMutation = useMutation({
    mutationFn: trialService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.success('Trial deleted successfully');
    },
    onError: () => {
      setIsConfirmOpen(false);
      setDeletingId(null);
      toast.error('Failed to delete trial');
    },
  });

  const trials = (data as any)?.trials || [];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "outline" | "destructive", className: string }> = {
      DRAFT: { variant: 'outline', className: 'bg-background text-foreground border-border hover:bg-muted/50' },
      IN_PROGRESS: { variant: 'default', className: 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' },
      COMPLETED: { variant: 'outline', className: 'bg-background text-foreground/70 border-border/50 hover:bg-muted/30' },
      ARCHIVED: { variant: 'destructive', className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20' },
    };
    return statusConfig[status] || { variant: 'default', className: '' };
  };

  const handleViewDetails = (trialId: string) => {
    setSelectedTrialId(trialId);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (trialId: string) => {
    setEditingTrialId(trialId);
    setIsAddModalOpen(true);
  };

  const handleDelete = (trialId: string) => {
    setDeletingId(trialId);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const handleFilterChange = (newFilters: TrialFilterValues) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const exportToExcel = async () => {
    try {
      toast.info('Exporting trials...');

      // Fetch all trials matching current filters (without pagination)
      const allTrials = await trialService.getAll({ ...filters, page: 1, limit: 10000 });
      const trialsData = (allTrials as any)?.trials || [];

      if (!trialsData || trialsData.length === 0) {
        toast.error('No trials to export');
        return;
      }

      // Create data for Excel
      const data = trialsData.map((trial: any) => ({
        'Farmer': trial.farmer?.name || '-',
        'Phone': trial.farmer?.contact || '-',
        'Product': trial.product?.name || '-',
        'Crop': trial.crop,
        'Village': trial.village,
        'Start Date': format(new Date(trial.start_date), 'MMM dd, yyyy'),
        'Applications': trial.applications?.length || 0,
        'Status': trial.status.replace('_', ' ')
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Trials');

      // Auto-size columns
      const maxWidth = data.reduce((w: any, r: any) => {
        return Object.keys(r).map((k, i) => Math.max(w[i] || 10, String(r[k]).length));
      }, []);
      ws['!cols'] = maxWidth.map((w: number) => ({ wch: w + 2 }));

      // Download
      XLSX.writeFile(wb, `trials-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success(`${trialsData.length} trials exported successfully`);
    } catch (error) {
      toast.error('Failed to export trials');
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Trials</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage and monitor all crop trials</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <PermissionGuard permission="trials:view">
            <Button variant="outline" onClick={exportToExcel} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="trials:manage">
            <Button onClick={() => setIsAddModalOpen(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Trial
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Filters */}
      <TrialFilters onFilterChange={handleFilterChange} initialFilters={filters} />

      <Card>
        <CardHeader>
          <CardDescription>
            {data?.pagination?.total || 0} total trials
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
                  <TableHead>Farmer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead>Village</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No trials found
                    </TableCell>
                  </TableRow>
                ) : (
                  trials.map((trial: any) => (
                    <TableRow
                      key={trial.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetails(trial.id)}
                    >
                      <TableCell>{trial.farmer?.name || '-'}</TableCell>
                      <TableCell>{trial.farmer?.contact || '-'}</TableCell>
                      <TableCell>{trial.product?.name || '-'}</TableCell>
                      <TableCell>{trial.crop}</TableCell>
                      <TableCell>{trial.village}</TableCell>
                      <TableCell>{format(new Date(trial.start_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {trial.applications?.length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadge(trial.status).variant}
                          className={getStatusBadge(trial.status).className}
                        >
                          {trial.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <div><span className="font-medium">{trial.creator?.name || '-'}</span> <span className="text-muted-foreground">{format(new Date(trial.created_at), 'MMM dd, yyyy')}</span></div>
                          {trial.updater && <div className="text-muted-foreground">edited by <span className="font-medium text-foreground">{trial.updater.name}</span></div>}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(trial.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <PermissionGuard permission="trials:manage">
                              {(trial.status !== 'COMPLETED' || user?.role === 'ADMIN') && (
                                <DropdownMenuItem onClick={() => handleEdit(trial.id)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDelete(trial.id)}
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

      {selectedTrialId && (
        <TrialDetailModal
          trialId={selectedTrialId}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedTrialId(null);
          }}
        />
      )}

      <AddTrialModalNew
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTrialId(null);
        }}
        trialId={editingTrialId}
      />

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this trial? This action cannot be undone.
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
