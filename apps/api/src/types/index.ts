import { Request } from 'express';

// Permission types for role-based access control
export type Permission =
  | 'canManageBatches'
  | 'canManageProducts'
  | 'canManageTrials'
  | 'canManageFarmers'
  | 'canManageUsers'
  | 'canViewReports'
  | 'canManageRawMaterials'
  | 'canManageBOM'
  | 'canManageProduction'
  | 'canManageCustomers'
  | 'canManageSuppliers'
  | 'canManagePurchaseOrders'
  | 'canManageSalesOrders'
  | 'canManageInvoices'
  | 'canManagePayments';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    permissions?: Record<string, boolean>;
  };
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}
