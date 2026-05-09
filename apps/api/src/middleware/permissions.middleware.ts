import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';

/**
 * Permission names that can be granted to users
 * Format: resource:action
 */
export type Permission =
  // Products
  | 'products:view'
  | 'products:create'
  | 'products:update'
  | 'products:delete'
  | 'products:manage'
  // Batches
  | 'batches:view'
  | 'batches:create'
  | 'batches:update'
  | 'batches:delete'
  | 'batches:manage'
  // Users
  | 'users:view'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'users:manage'
  // Trials
  | 'trials:view'
  | 'trials:create'
  | 'trials:update'
  | 'trials:delete'
  | 'trials:manage'
  // Farmers
  | 'farmers:view'
  | 'farmers:create'
  | 'farmers:update'
  | 'farmers:delete'
  | 'farmers:manage'
  // Raw Materials
  | 'raw-materials:view'
  | 'raw-materials:create'
  | 'raw-materials:update'
  | 'raw-materials:delete'
  | 'raw-materials:manage'
  // Raw Material Batches
  | 'raw-material-batches:view'
  | 'raw-material-batches:create'
  | 'raw-material-batches:update'
  | 'raw-material-batches:delete'
  | 'raw-material-batches:manage'
  // BOM (Bill of Materials)
  | 'bom:view'
  | 'bom:create'
  | 'bom:update'
  | 'bom:delete'
  | 'bom:manage'
  // Production
  | 'production:view'
  | 'production:create'
  | 'production:update'
  | 'production:delete'
  | 'production:manage'
  // Customers
  | 'customers:view'
  | 'customers:create'
  | 'customers:update'
  | 'customers:delete'
  | 'customers:manage'
  // Suppliers
  | 'suppliers:view'
  | 'suppliers:create'
  | 'suppliers:update'
  | 'suppliers:delete'
  | 'suppliers:manage'
  // Purchase Orders
  | 'purchase-orders:view'
  | 'purchase-orders:create'
  | 'purchase-orders:update'
  | 'purchase-orders:delete'
  | 'purchase-orders:manage'
  // Sales Orders
  | 'sales-orders:view'
  | 'sales-orders:create'
  | 'sales-orders:update'
  | 'sales-orders:delete'
  | 'sales-orders:manage'
  // Delivery Notes
  | 'delivery-notes:view'
  | 'delivery-notes:create'
  | 'delivery-notes:update'
  | 'delivery-notes:delete'
  | 'delivery-notes:manage'
  // Invoices
  | 'invoices:view'
  | 'invoices:create'
  | 'invoices:update'
  | 'invoices:delete'
  | 'invoices:manage'
  // Payments
  | 'payments:view'
  | 'payments:create'
  | 'payments:update'
  | 'payments:delete'
  | 'payments:manage'
  // Pricing Rules
  | 'pricing-rules:view'
  | 'pricing-rules:create'
  | 'pricing-rules:update'
  | 'pricing-rules:delete'
  | 'pricing-rules:manage'
  // Applications
  | 'applications:view'
  | 'applications:create'
  | 'applications:update'
  | 'applications:delete'
  | 'applications:manage'
  // Photos
  | 'photos:view'
  | 'photos:create'
  | 'photos:update'
  | 'photos:delete'
  | 'photos:manage'
  // Company Settings
  | 'company-settings:view'
  | 'company-settings:update'
  | 'company-settings:manage'
  // Reports
  | 'reports:view'
  // Dashboard
  | 'dashboard:view';

/**
 * Permission hierarchy - higher-level permissions include lower-level ones
 * Format: permission -> array of permissions it includes
 */
const PERMISSION_HIERARCHY: Record<string, string[]> = {
  // Manage permission includes all CRUD permissions
  'manage': ['view', 'create', 'update', 'delete'],
  // CRUD permissions include view
  'create': ['view'],
  'update': ['view'],
  'delete': ['view'],
};

/**
 * Cross-resource permission dependencies
 * Format: permission -> array of required permissions from other resources
 */
const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  // Trials require farmers and products to be viewed, and managing trials requires managing applications
  'trials:create': ['farmers:view', 'products:view'],
  'trials:update': ['farmers:view', 'products:view'],
  'trials:manage': ['farmers:view', 'products:view', 'applications:manage'],

  // Applications require batches and trials
  'applications:create': ['batches:view', 'trials:view'],
  'applications:update': ['batches:view', 'trials:view'],
  'applications:manage': ['batches:view', 'trials:view'],

  // Batches require products
  'batches:create': ['products:view'],
  'batches:update': ['products:view'],
  'batches:manage': ['products:view'],

  // Production requires products, raw materials, and BOM
  'production:create': ['products:view', 'raw-materials:view', 'bom:view'],
  'production:update': ['products:view', 'raw-materials:view', 'bom:view'],
  'production:manage': ['products:view', 'raw-materials:view', 'bom:view'],

  // BOM requires products and raw materials
  'bom:create': ['products:view', 'raw-materials:view'],
  'bom:update': ['products:view', 'raw-materials:view'],
  'bom:manage': ['products:view', 'raw-materials:view'],

  // Sales orders require customers and products
  'sales-orders:create': ['customers:view', 'products:view'],
  'sales-orders:update': ['customers:view', 'products:view'],
  'sales-orders:manage': ['customers:view', 'products:view'],

  // Invoices require sales orders and customers
  'invoices:create': ['sales-orders:view', 'customers:view'],
  'invoices:update': ['sales-orders:view', 'customers:view'],
  'invoices:manage': ['sales-orders:view', 'customers:view'],

  // Purchase orders require suppliers and raw materials
  'purchase-orders:create': ['suppliers:view', 'raw-materials:view'],
  'purchase-orders:update': ['suppliers:view', 'raw-materials:view'],
  'purchase-orders:manage': ['suppliers:view', 'raw-materials:view'],

  // Raw material batches require raw materials
  'raw-material-batches:create': ['raw-materials:view'],
  'raw-material-batches:update': ['raw-materials:view'],
  'raw-material-batches:manage': ['raw-materials:view'],
};

/**
 * Get action hierarchy for a permission (e.g., manage -> view, create, update, delete)
 */
function getActionHierarchy(permission: Permission): Permission[] {
  const [resource, action] = permission.split(':');
  const implied: Permission[] = [permission];

  const impliedActions = PERMISSION_HIERARCHY[action] || [];
  for (const impliedAction of impliedActions) {
    implied.push(`${resource}:${impliedAction}` as Permission);
  }

  return implied;
}

/**
 * Get all permissions implied by a given permission (including itself)
 * Includes both action-level hierarchy and cross-resource dependencies
 */
function getImpliedPermissions(permission: Permission, visited = new Set<string>()): Permission[] {
  if (visited.has(permission)) return [];
  visited.add(permission);

  const implied: Permission[] = [];

  // 1. Add action-level hierarchy (e.g., manage -> view, create, update, delete)
  const hierarchy = getActionHierarchy(permission);
  hierarchy.forEach(p => {
    if (!implied.includes(p)) {
      implied.push(p);
    }
  });

  // 2. Add cross-resource dependencies and their hierarchies
  const dependencies = PERMISSION_DEPENDENCIES[permission] || [];
  for (const dep of dependencies) {
    const depHierarchy = getActionHierarchy(dep as Permission);
    depHierarchy.forEach(p => {
      if (!implied.includes(p)) {
        implied.push(p);
      }
    });

    // Recursively get dependencies of dependencies
    const subDeps = getImpliedPermissions(dep as Permission, visited);
    subDeps.forEach(p => {
      if (!implied.includes(p)) {
        implied.push(p);
      }
    });
  }

  return implied;
}

/**
 * Check if a user has a specific permission (with hierarchy support)
 */
export function hasPermission(user: AuthRequest['user'], permission: Permission): boolean {
  if (!user) return false;

  // ADMIN has all permissions by default
  if (user.role === 'ADMIN') return true;

  // Check user-specific permissions (array format)
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  // Check if user has the exact permission
  if (permissions.includes(permission)) return true;

  // Check if user has a higher-level permission that includes this one
  const [resource, action] = permission.split(':');

  // Check each user permission to see if it implies the requested permission
  for (const userPermission of permissions) {
    const impliedPermissions = getImpliedPermissions(userPermission);
    if (impliedPermissions.includes(permission)) {
      return true;
    }
  }

  return false;
}

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `You don't have permission to perform this action. Required: ${permission}`
      });
    }

    next();
  };
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(user: AuthRequest['user'], permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(user, permission));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(user: AuthRequest['user'], permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(user, permission));
}
