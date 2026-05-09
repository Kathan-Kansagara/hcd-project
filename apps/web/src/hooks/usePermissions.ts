import { useAuth } from '../contexts/AuthContext';
import type { Permission } from '../types';

/**
 * Hook to check user permissions
 * Follows the same logic as backend permission system
 */
export function usePermissions() {
  const { user } = useAuth();

  /**
   * Check if user has a specific permission
   * ADMIN users have all permissions by default
   */
  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;

    // ADMIN has all permissions by default
    if (user.role === 'ADMIN') return true;

    // Check user-specific permissions (array format)
    const permissions = user.permissions || [];
    return permissions.includes(permission);
  };

  /**
   * Check if user has ANY of the specified permissions
   */
  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  /**
   * Check if user has ALL of the specified permissions
   */
  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  /**
   * Check if user can view a resource (convenience method)
   */
  const canView = (resource: string): boolean => {
    return hasPermission(`${resource}:view`);
  };

  /**
   * Check if user can manage a resource (convenience method)
   */
  const canManage = (resource: string): boolean => {
    return hasPermission(`${resource}:manage`);
  };

  /**
   * Check if user is ADMIN
   */
  const isAdmin = (): boolean => {
    return user?.role === 'ADMIN';
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canView,
    canManage,
    isAdmin,
  };
}
