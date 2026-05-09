import apiClient from '../lib/axios';

export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  specifications?: any;
  unit: string;
  gst_rate?: number;
  hsn_sac_code?: string;
  default_unit_price?: number;
  min_stock_level?: number;
  reorder_point?: number;
  supplier_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RawMaterialsResponse {
  raw_materials: RawMaterial[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const rawMaterialService = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<RawMaterialsResponse> => {
    const response = await apiClient.get<RawMaterialsResponse>('/raw-materials', { params });
    return response.data;
  },

  getById: async (id: string): Promise<RawMaterial> => {
    const response = await apiClient.get<{ raw_material: RawMaterial }>(`/raw-materials/${id}`);
    return response.data.raw_material;
  },

  getNextCode: async (): Promise<string> => {
    const response = await apiClient.get<{ code: string }>('/raw-materials/next-code');
    return response.data.code;
  },

  getCategories: async (): Promise<string[]> => {
    const response = await apiClient.get<{ categories: string[] }>('/raw-materials/categories/list');
    return response.data.categories;
  },

  getSuppliers: async (): Promise<string[]> => {
    const response = await apiClient.get<{ suppliers: string[] }>('/raw-materials/suppliers/list');
    return response.data.suppliers;
  },

  getStockSummary: async (id: string) => {
    const response = await apiClient.get(`/raw-materials/${id}/stock-summary`);
    return response.data;
  },

  create: async (data: Partial<RawMaterial>): Promise<RawMaterial> => {
    const response = await apiClient.post<{ raw_material: RawMaterial }>('/raw-materials', data);
    return response.data.raw_material;
  },

  update: async (id: string, data: Partial<RawMaterial>): Promise<RawMaterial> => {
    const response = await apiClient.put<{ raw_material: RawMaterial }>(`/raw-materials/${id}`, data);
    return response.data.raw_material;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/raw-materials/${id}`);
  },
};
