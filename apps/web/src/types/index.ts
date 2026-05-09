// API Types
export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface DashboardStats {
  totalTrials: number;
  inProgressTrials: number;
  completedTrials: number;
  totalFarmers: number;
  activeBatches: number;
  expiringSoon: number;
  lowStock: number;
  totalStock: number;
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
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
}

export interface Trial {
  id: string;
  farmer_id: string;
  product_id: string;
  crop: string;
  village: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  season?: string;
  start_date: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
  gps_lat?: number;
  gps_lng?: number;
  with_other_products?: string;
  yield_value?: number;
  yield_unit?: string;
  comments?: string;
  rating?: number;
  is_successful?: boolean;
  created_by: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
  farmer?: Farmer;
  product?: Product;
  creator?: User;
  applications?: Application[];
}

export interface Batch {
  id: string;
  batch_number: string;
  product_id: string;
  manufacturing_date: string;
  expiry_date?: string;
  quantity: number;
  quantity_remaining: number;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  trial_id: string;
  app_number: number;
  app_type: 'DRIP' | 'IRRIGATION' | 'SPRAY';
  app_date: string;
  end_date?: string;
  status: string;
  batch_id?: string;
  quantity_used?: number;
  before_comments?: string;
  after_comments?: string;
  created_at: string;
  updated_at: string;
  batch?: Batch;
  photos?: Photo[];
}

export interface Photo {
  id: string;
  application_id: string;
  stage: 'BEFORE_UNTREATED' | 'AFTER_TREATED';
  file_url: string;
  thumbnail_url?: string;
  file_size: number;
  gps_lat?: number;
  gps_lng?: number;
  exif_timestamp?: string;
  created_by: string;
  created_at: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type Permission = string; // e.g., 'products:view', 'trials:manage'

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUBADMIN';
  permissions?: string[];
  created_at?: string;
  updated_at?: string;
}
