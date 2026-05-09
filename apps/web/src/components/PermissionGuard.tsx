import { usePermissions } from '../hooks/usePermissions';
import type { Permission } from '../types';
import type { ReactNode } from 'react';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

/**
 * Component to conditionally render UI based on permissions
 * Unlike ProtectedRoute, this doesn't redirect - it just hides/shows content
 *
 * Usage:
 *   <PermissionGuard permission="products:manage">
 *     <Button>Create Product</Button>
 *   </PermissionGuard>
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback = null
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let hasAccess = true;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
