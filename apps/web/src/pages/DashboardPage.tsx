import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MoreVertical } from 'lucide-react';
import { dashboardService } from '../services/dashboard.service';
import { trialService } from '../services/trial.service';
import { farmerService } from '../services/farmer.service';
import Layout from '../components/layout/Layout';
import DataTable from '../components/common/DataTable';
import TrialDetailModal from '../components/trials/TrialDetailModal';
import AddTrialModal from '../components/trials/AddTrialModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../components/ui/dropdown-menu';
import type { Column } from '../components/common/DataTable';
import { format } from 'date-fns';

export default function DashboardPage() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [filters, setFilters] = useState({
    product_id: '',
    farmer_id: '',
    crop: '',
    village: '',
    season: '',
    start_date_from: '',
    start_date_to: '',
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardService.getStats,
  });

  const { data: trialsData, isLoading: trialsLoading } = useQuery({
    queryKey: ['trials', filters],
    queryFn: () => trialService.getAll(filters as any),
  });

  const { data: farmersData } = useQuery({
    queryKey: ['farmers'],
    queryFn: () => farmerService.getAll(),
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      DRAFT: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-orange-100 text-orange-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return styles[status as keyof typeof styles] || styles.DRAFT;
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      product_id: '',
      farmer_id: '',
      crop: '',
      village: '',
      season: '',
      start_date_from: '',
      start_date_to: '',
    });
    setCurrentPage(1);
  };

  // Pagination logic
  const trials = trialsData?.data || [];
  const totalPages = Math.ceil(trials.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTrials = trials.slice(startIndex, endIndex);

  // Define columns for DataTable
  const columns: Column<any>[] = [
    {
      header: 'Farmer',
      render: (trial) => trial.farmer?.name || '-',
    },
    {
      header: 'Product',
      render: (trial) => trial.product?.name || '-',
    },
    {
      header: 'Crop',
      accessor: 'crop',
    },
    {
      header: 'Village',
      accessor: 'village',
    },
    {
      header: 'Start Date',
      render: (trial) => format(new Date(trial.start_date), 'MMM dd, yyyy'),
    },
    {
      header: 'Status',
      render: (trial) => (
        <span
          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
            trial.status
          )}`}
        >
          {trial.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (trial) => (
        <DropdownMenu open={openDropdown === trial.id} onOpenChange={(open) => setOpenDropdown(open ? trial.id : null)}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setSelectedTrialId(trial.id);
                setIsDetailModalOpen(true);
              }}
            >
              View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (statsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header with Add New Trial Button */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-gray-600 mt-1">Overview of your crop trials</p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>
            + Add New Trial
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Trials */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Trials</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.total_trials || 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Completed Trials */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {stats?.completed || 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* In Progress Trials */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {stats?.in_progress || 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            <Button
              onClick={clearFilters}
              variant="ghost"
              size="sm"
            >
              Clear All
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="farmer">Farmer</Label>
              <select
                id="farmer"
                value={filters.farmer_id}
                onChange={(e) => handleFilterChange('farmer_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Farmers</option>
                {farmersData?.data?.map((farmer: any) => (
                  <option key={farmer.id} value={farmer.id}>
                    {farmer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="crop">Crop</Label>
              <Input
                id="crop"
                type="text"
                value={filters.crop}
                onChange={(e) => handleFilterChange('crop', e.target.value)}
                placeholder="Enter crop name"
              />
            </div>

            <div>
              <Label htmlFor="village">Village</Label>
              <Input
                id="village"
                type="text"
                value={filters.village}
                onChange={(e) => handleFilterChange('village', e.target.value)}
                placeholder="Enter village"
              />
            </div>

            <div>
              <Label htmlFor="season">Season</Label>
              <Input
                id="season"
                type="text"
                value={filters.season}
                onChange={(e) => handleFilterChange('season', e.target.value)}
                placeholder="e.g., Kharif 2025"
              />
            </div>

            <div>
              <Label htmlFor="date-from">Date From</Label>
              <Input
                id="date-from"
                type="date"
                value={filters.start_date_from}
                onChange={(e) => handleFilterChange('start_date_from', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="date-to">Date To</Label>
              <Input
                id="date-to"
                type="date"
                value={filters.start_date_to}
                onChange={(e) => handleFilterChange('start_date_to', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Trials Table */}
        <div>
          <div className="bg-white rounded-xl shadow-md px-6 py-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">All Trials</h3>
          </div>
          <DataTable
            columns={columns}
            data={paginatedTrials}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            isLoading={trialsLoading}
            emptyMessage="No trials found"
            rowKey={(trial) => trial.id}
          />
        </div>
      </div>

      {/* Add Trial Modal */}
      <AddTrialModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      {/* Trial Detail Modal */}
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
    </Layout>
  );
}
