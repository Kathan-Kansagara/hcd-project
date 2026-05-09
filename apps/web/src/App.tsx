import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SmartRedirect } from './components/SmartRedirect';
import { Toaster } from '@/components/ui/sonner';
import LayoutNew from './components/layout/LayoutNew';
import LoginPage from './pages/LoginPage';
import DashboardPageNew from './pages/DashboardPageNew';
import TrialsPageNew from './pages/TrialsPageNew';
import FarmersPageNew from './pages/FarmersPageNew';
import ProductsPageNew from './pages/ProductsPageNew';
import BatchesPageNew from './pages/BatchesPageNew';
import UsersPageNew from './pages/UsersPageNew';
import RawMaterialsPage from './pages/RawMaterialsPage';
import BOMPage from './pages/BOMPage';
import ProductionPage from './pages/ProductionPage';
import CustomersPage from './pages/CustomersPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import RMBatchesPage from './pages/RMBatchesPage';
import SalesOrdersPage from './pages/SalesOrdersPage';
import InvoicesPage from './pages/InvoicesPage';
import PaymentsPage from './pages/PaymentsPage';
import CompanySettingsPage from './pages/CompanySettingsPage';
import InventoryOverviewPage from './pages/InventoryOverviewPage';
import SalesCustomerOverviewPage from './pages/SalesCustomerOverviewPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Shared layout route — sidebar persists across navigations */}
      <Route
        element={
          <ProtectedRoute>
            <LayoutNew />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={<SmartRedirect />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute permission="dashboard:view">
              <DashboardPageNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trials"
          element={
            <ProtectedRoute permission="trials:view">
              <TrialsPageNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/farmers"
          element={
            <ProtectedRoute permission="farmers:view">
              <FarmersPageNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute permission="products:view">
              <ProductsPageNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/batches"
          element={
            <ProtectedRoute permission="batches:view">
              <BatchesPageNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute permission="users:view">
              <UsersPageNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory-overview"
          element={
            <ProtectedRoute permission="products:view">
              <InventoryOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/raw-materials"
          element={
            <ProtectedRoute permission="raw-materials:view">
              <RawMaterialsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bom"
          element={
            <ProtectedRoute permission="bom:view">
              <BOMPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/production"
          element={
            <ProtectedRoute permission="production:view">
              <ProductionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-overview"
          element={
            <ProtectedRoute permission="sales-orders:view">
              <SalesCustomerOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute permission="customers:view">
              <CustomersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute permission="suppliers:view">
              <SuppliersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase-orders"
          element={
            <ProtectedRoute permission="purchase-orders:view">
              <PurchaseOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rm-batches"
          element={
            <ProtectedRoute permission="raw-material-batches:view">
              <RMBatchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-orders"
          element={
            <ProtectedRoute permission="sales-orders:view">
              <SalesOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <ProtectedRoute permission="invoices:view">
              <InvoicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute permission="payments:view">
              <PaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute permission="company-settings:view">
              <CompanySettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
