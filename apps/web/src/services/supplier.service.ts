import apiClient from '../lib/axios';

export interface Supplier {
  id: string;
  company_name: string;
  contact_person?: string;
  contact: string;
  email: string;
  address_line1: string;
  address_line2?: string;
  city?: string | null;
  state?: string | null;
  district?: string | null;
  pincode?: string | null;
  gstin?: string;
  payment_terms: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateSupplierData = {
  company_name: string;
  contact_person?: string;
  contact?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  district?: string;
  pincode?: string;
  gstin?: string;
  payment_terms?: string;
};

export type UpdateSupplierData = Partial<CreateSupplierData>;

export interface SupplierListResponse {
  suppliers: Supplier[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const supplierService = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<SupplierListResponse> => {
    const response = await apiClient.get<SupplierListResponse>('/suppliers', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Supplier> => {
    const response = await apiClient.get<{ supplier: Supplier }>(`/suppliers/${id}`);
    return response.data.supplier;
  },

  create: async (data: CreateSupplierData): Promise<Supplier> => {
    const response = await apiClient.post<{ supplier: Supplier }>('/suppliers', data);
    return response.data.supplier;
  },

  update: async (id: string, data: UpdateSupplierData): Promise<Supplier> => {
    const response = await apiClient.put<{ supplier: Supplier }>(`/suppliers/${id}`, data);
    return response.data.supplier;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/suppliers/${id}`);
  },
};
