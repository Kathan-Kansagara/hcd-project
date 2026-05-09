import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, Plus, Eye, Trash, FlaskConical, Timer, CheckCircle, Pencil, PackageCheck, AlertTriangle, ArrowRight, DollarSign, TrendingUp, ShoppingCart, Users, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { dashboardService } from '../services/dashboard.service';
import { trialService } from '../services/trial.service';
import { batchService } from '../services/batch.service';
import { analyticsService } from '../services/analytics.service';
import { invoiceService } from '../services/invoice.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import TrialDetailModal from '../components/trials/TrialDetailModal';
import AddTrialModalNew from '../components/trials/AddTrialModalNew';
import { StatusBadge } from '@/components/ui/status-badge';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPageNew() {
  useBreadcrumbs([{ label: 'Dashboard' }]);
  const queryClient = useQueryClient();
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTrialId, setEditingTrialId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardService.getStats,
  });

  const { data: recentTrialsData, isLoading: trialsLoading } = useQuery({
    queryKey: ['recent-trials'],
    queryFn: () => trialService.getAll({ page: 1, limit: 5 }),
  });

  const { data: batchesData } = useQuery({
    queryKey: ['dashboard-batches'],
    queryFn: () => batchService.getAll({ page: 1, limit: 100, is_active: true }),
  });

  const { data: salesAnalytics, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-analytics'],
    queryFn: () => analyticsService.getSalesAnalytics(30),
  });

  const { data: purchaseAnalytics, isLoading: purchaseLoading } = useQuery({
    queryKey: ['purchase-analytics'],
    queryFn: () => analyticsService.getPurchaseAnalytics(30),
  });

  // Fetch outstanding invoices (UNPAID, PARTIALLY_PAID, OVERDUE)
  const { data: outstandingInvoicesData } = useQuery({
    queryKey: ['outstanding-invoices'],
    queryFn: () => invoiceService.getInvoices({
      page: 1,
      limit: 10,
      // Note: The API doesn't currently support status filter, but we'll filter client-side
    }),
  });

  const trials = (recentTrialsData as any)?.trials || [];
  const batches = (batchesData as any)?.batches || [];
  const allInvoices = (outstandingInvoicesData as any)?.invoices || [];

  // Filter outstanding invoices (SENT, PARTIALLY_PAID, OVERDUE - i.e. unpaid and not cancelled/draft)
  const outstandingInvoices = allInvoices.filter((inv: any) =>
    inv.status === 'SENT' || inv.status === 'PARTIALLY_PAID' || inv.status === 'OVERDUE'
  );

  // Calculate batch stats
  const totalBatches = batches.length;

  // Expiring batches (within 30 days)
  const expiringBatchesList = batches.filter((batch: any) => {
    const daysUntilExpiry = Math.ceil((new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  });
  const expiringBatches = expiringBatchesList.length;

  // Low stock batches (below 30% remaining)
  const lowStockBatchesList = batches.filter((batch: any) => {
    if (!batch.quantity_produced || batch.quantity_produced <= 0) return false;
    const percentRemaining = (batch.quantity_remaining / batch.quantity_produced) * 100;
    return percentRemaining < 30 && percentRemaining > 0;
  });
  const lowStockBatches = lowStockBatchesList.length;

  const totalStock = batches.reduce((acc: number, batch: any) => acc + batch.quantity_remaining, 0);

  const deleteMutation = useMutation({
    mutationFn: trialService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-trials'] });
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

  // Calculate days until expiry
  const getDaysUntilExpiry = (expiryDate: string) => {
    return Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  // Calculate days overdue
  const getDaysOverdue = (dueDate: string) => {
    const days = Math.ceil((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Overview of Zenon Bio Science operations</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Trial
        </Button>
      </div>

      {/* Trial Stats Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Trial Statistics</h2>
        <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trials</CardTitle>
            <FlaskConical className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalTrials || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">All crop trials</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Timer className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.inProgressTrials || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Active trials</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.completedTrials || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Finished trials</p>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Batch & Stock Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Inventory Status</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Batches</CardTitle>
              <PackageCheck className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBatches}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Link to="/batches" className="block">
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{expiringBatches}</div>
                <p className="text-xs text-muted-foreground">Within 30 days</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/batches" className="block">
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{lowStockBatches}</div>
                <p className="text-xs text-muted-foreground">Below 30% remaining</p>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
              <PackageCheck className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStock.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Liters available</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sales & Purchase Analytics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Sales & Purchase Overview</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  ₹{salesAnalytics?.total_revenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Amount Paid</CardTitle>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  ₹{salesAnalytics?.total_paid?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Received payments</p>
            </CardContent>
          </Card>

          <Link to="/invoices" className="block">
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold text-orange-600">
                    ₹{salesAnalytics?.total_outstanding?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Pending payments</p>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Purchase Value</CardTitle>
              <ShoppingCart className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              {purchaseLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  ₹{purchaseAnalytics?.total_purchase_value?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Low Stock Alerts
                </CardTitle>
                <CardDescription>Batches below 30% stock</CardDescription>
              </div>
              <StatusBadge
                status={lowStockBatches > 0 ? 'LOW_STOCK' : 'IN_STOCK'}
                className="text-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            {lowStockBatchesList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No low stock items
              </p>
            ) : (
              <div className="space-y-2">
                {lowStockBatchesList.slice(0, 5).map((batch: any) => {
                  const percentRemaining = batch.quantity_produced > 0 ? (batch.quantity_remaining / batch.quantity_produced) * 100 : 0;
                  return (
                    <Link
                      key={batch.id}
                      to="/batches"
                      className="block p-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{batch.batch_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.product?.name || 'Unknown Product'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-600">
                            {percentRemaining.toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {batch.quantity_remaining.toFixed(1)}L left
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-2 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
                {lowStockBatchesList.length > 5 && (
                  <Link to="/batches" className="block">
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      View All {lowStockBatchesList.length} Items
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Batch Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Expiring Batches
                </CardTitle>
                <CardDescription>Expiring within 30 days</CardDescription>
              </div>
              <StatusBadge
                status={expiringBatches > 0 ? 'EXPIRING_SOON' : 'ACTIVE'}
                className="text-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            {expiringBatchesList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No expiring batches
              </p>
            ) : (
              <div className="space-y-2">
                {expiringBatchesList.slice(0, 5).map((batch: any) => {
                  const daysUntilExpiry = getDaysUntilExpiry(batch.expiry_date);
                  return (
                    <Link
                      key={batch.id}
                      to="/batches"
                      className="block p-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{batch.batch_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.product?.name || 'Unknown Product'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-orange-600">
                            {daysUntilExpiry} days
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(batch.expiry_date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-2 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
                {expiringBatchesList.length > 5 && (
                  <Link to="/batches" className="block">
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      View All {expiringBatchesList.length} Items
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outstanding Payment Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-orange-500" />
                  Outstanding Payments
                </CardTitle>
                <CardDescription>Pending invoices</CardDescription>
              </div>
              <StatusBadge
                status={outstandingInvoices.length > 0 ? 'PENDING' : 'PAID'}
                className="text-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            {outstandingInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No outstanding payments
              </p>
            ) : (
              <div className="space-y-2">
                {outstandingInvoices.slice(0, 5).map((invoice: any) => {
                  const isOverdue = invoice.status === 'OVERDUE';
                  const daysOverdue = isOverdue ? getDaysOverdue(invoice.due_date) : 0;

                  return (
                    <Link
                      key={invoice.id}
                      to="/invoices"
                      className="block p-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{invoice.invoice_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.customer?.company_name || invoice.customer?.client_name || 'Unknown Customer'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-orange-600'}`}>
                            ₹{invoice.amount_due?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isOverdue ? `${daysOverdue} days overdue` : 'Pending'}
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-2 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
                {outstandingInvoices.length > 5 && (
                  <Link to="/invoices" className="block">
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      View All {outstandingInvoices.length} Invoices
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Trials Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Recent Trials</CardTitle>
              <CardDescription>Last 5 trials added to the system</CardDescription>
            </div>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/trials">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {trialsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
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
                  <TableHead>Product</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead>Village</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No trials found
                    </TableCell>
                  </TableRow>
                ) : (
                  trials.map((trial: any) => (
                    <TableRow key={trial.id}>
                      <TableCell className="font-medium">{trial.farmer?.name || '-'}</TableCell>
                      <TableCell>{trial.product?.name || '-'}</TableCell>
                      <TableCell>{trial.crop}</TableCell>
                      <TableCell>{trial.village}</TableCell>
                      <TableCell>{format(new Date(trial.start_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <StatusBadge status={trial.status} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {trial.applications?.length || 0}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => handleViewDetails(trial.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(trial.id)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(trial.id)}
                              className="text-destructive"
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Delete
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
        </CardContent>
      </Card>

      {/* Modals */}
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
