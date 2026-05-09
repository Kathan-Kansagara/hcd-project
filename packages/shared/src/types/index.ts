export enum Role {
  ADMIN = 'ADMIN',
  FIELD_AGENT = 'FIELD_AGENT',
  VIEWER = 'VIEWER',
}

export enum TrialStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum AppType {
  DRIP = 'DRIP',
  IRRIGATION = 'IRRIGATION',
  SPRAY = 'SPRAY',
}

export enum PhotoStage {
  BEFORE_UNTREATED = 'BEFORE_UNTREATED',
  AFTER_TREATED = 'AFTER_TREATED',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: Date;
  updated_at: Date;
}

export interface Farmer {
  id: string;
  name: string;
  village: string;
  contact?: string;
  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at: Date;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at: Date;
}

export interface Trial {
  id: string;
  farmer_id: string;
  product_id: string;
  crop: string;
  village: string;
  season?: string;
  start_date: Date;
  status: TrialStatus;
  gps_lat?: number;
  gps_lng?: number;
  with_other_products?: string;
  yield_value?: number;
  yield_unit?: string;
  comments?: string;
  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at: Date;
}

export interface Application {
  id: string;
  trial_id: string;
  app_number: number;
  app_type: AppType;
  app_date: Date;
  status: string;
  before_comments?: string;
  after_comments?: string;
  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at: Date;
}

export interface Photo {
  id: string;
  application_id: string;
  stage: PhotoStage;
  file_path: string;
  file_url: string;
  file_size: number;
  thumbnail_path?: string;
  gps_lat?: number;
  gps_lng?: number;
  exif_timestamp?: Date;
  created_by: string;
  created_at: Date;
}

