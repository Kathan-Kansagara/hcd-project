export type Permission = string; // e.g., 'products:view', 'trials:manage'

// Common audit info returned by API
export interface AuditUser {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUBADMIN';
  permissions?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Farmer {
  id: string;
  name: string;
  village: string;
  city?: string;
  taluka?: string;
  district?: string;
  state?: string;
  pincode?: string;
  contact?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  creator?: AuditUser;
  updater?: AuditUser | null;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  created_at: string;
  updated_at: string;
  creator?: AuditUser;
  updater?: AuditUser | null;
}

export interface Trial {
  id: string;
  farmer_id: string;
  product_id: string;
  crop: string;
  village: string;
  city?: string;
  taluka?: string;
  district?: string;
  state?: string;
  pincode?: string;
  season?: string;
  start_date: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
  gps_lat?: number;
  gps_lng?: number;
  comments?: string;
  created_at: string;
  updated_at: string;
  farmer?: Farmer;
  product?: Product;
  applications?: Application[];
  creator?: AuditUser;
  updater?: AuditUser | null;
}

export interface Batch {
  id: string;
  product_id: string;
  batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  quantity_produced: number;
  quantity_remaining: number;
  unit: 'LITER' | 'KG' | 'PIECE';
  storage_location?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product?: Product;
  creator?: AuditUser;
  updater?: AuditUser | null;
}

export interface Application {
  id: string;
  trial_id: string;
  batch_id?: string;
  app_number: number;
  app_type: 'DRIP' | 'IRRIGATION' | 'SPRAY';
  app_date: string;
  status: string;
  quantity_used?: number;
  before_comments?: string;
  after_comments?: string;
  created_at: string;
  updated_at: string;
}
