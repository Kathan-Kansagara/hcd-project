import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Smart redirect component that routes users to their first available page
 * based on their permissions
 */
export function SmartRedirect() {
  const { hasPermission, isAdmin } = usePermissions();

  // Define pages in priority order
  const pages = [
    { path: '/dashboard', permission: 'dashboard:view' },
    { path: '/trials', permission: 'trials:view' },
    { path: '/farmers', permission: 'farmers:view' },
    { path: '/products', permission: 'products:view' },
    { path: '/batches', permission: 'batches:view' },
    { path: '/raw-materials', permission: 'raw-materials:view' },
    { path: '/bom', permission: 'bom:view' },
    { path: '/production', permission: 'production:view' },
    { path: '/customers', permission: 'customers:view' },
    { path: '/suppliers', permission: 'suppliers:view' },
    { path: '/purchase-orders', permission: 'purchase-orders:view' },
    { path: '/rm-batches', permission: 'raw-material-batches:view' },
    { path: '/sales-orders', permission: 'sales-orders:view' },
    { path: '/invoices', permission: 'invoices:view' },
    { path: '/payments', permission: 'payments:view' },
    { path: '/users', permission: 'users:view' },
  ];

  // Admin users always go to dashboard
  if (isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  // Find first page the user has access to
  for (const page of pages) {
    if (hasPermission(page.permission)) {
      return <Navigate to={page.path} replace />;
    }
  }

  // If no permissions, show access denied
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">No Access</h1>
        <p className="text-gray-600">
          You don't have permission to access any pages. Please contact your administrator.
        </p>
      </div>
    </div>
  );
}
