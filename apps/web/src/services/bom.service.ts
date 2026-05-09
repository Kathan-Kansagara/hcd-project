import apiClient from '../lib/axios';

export interface ProductBOMSummary {
  product_id: string;
  product_name: string;
  product_category: string | null;
  product_description: string | null;
  material_count: number;
  categories: string[];
  last_updated: string;
}

export interface ProductBOMListResponse {
  products: ProductBOMSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BOMItem {
  id: string;
  product_id: string;
  raw_material_id: string;
  quantity_per_unit: number;
  unit: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    category?: string;
  };
  raw_material?: {
    id: string;
    code: string;
    name: string;
    category: string;
    unit?: string;
  };
}

interface BOMResponse {
  product: {
    id: string;
    name: string;
  };
  bom_items: BOMItem[];
  total_items: number;
}

interface BOMListResponse {
  bom_items: BOMItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const bomService = {
  getProductsWithBOM: async ({ page = 1, limit = 10, search }: { page?: number; limit?: number; search?: string } = {}): Promise<ProductBOMListResponse> => {
    const params: any = { page, limit };
    if (search) params.search = search;
    const response = await apiClient.get<ProductBOMListResponse>('/bom/products', { params });
    return response.data;
  },

  deleteProductBOM: async (productId: string): Promise<{ message: string; count: number }> => {
    const response = await apiClient.delete<{ message: string; count: number }>(`/bom/product/${productId}`);
    return response.data;
  },

  getAll: async ({ page = 1, limit = 10, product_id }: { page?: number; limit?: number; product_id?: string } = {}): Promise<BOMListResponse> => {
    const params: any = { page, limit };
    if (product_id) params.product_id = product_id;
    const response = await apiClient.get<BOMListResponse>('/bom', { params });
    return response.data;
  },

  getByProduct: async (productId: string): Promise<BOMResponse> => {
    const response = await apiClient.get<BOMResponse>(`/bom/product/${productId}`);
    return response.data;
  },

  getById: async (id: string): Promise<BOMItem> => {
    const response = await apiClient.get<{ bom_item: BOMItem }>(`/bom/${id}`);
    return response.data.bom_item;
  },

  create: async (data: Partial<BOMItem>): Promise<BOMItem> => {
    const response = await apiClient.post<{ bom_item: BOMItem }>('/bom', data);
    return response.data.bom_item;
  },

  bulkCreate: async (data: {
    product_id: string;
    items: Array<{
      raw_material_id: string;
      quantity_per_unit: number;
      unit: string;
      notes?: string;
    }>;
  }): Promise<{ bom_items: BOMItem[]; count: number }> => {
    const response = await apiClient.post<{ bom_items: BOMItem[]; count: number }>('/bom/bulk', data);
    return response.data;
  },

  update: async (id: string, data: Partial<BOMItem>): Promise<BOMItem> => {
    const response = await apiClient.put<{ bom_item: BOMItem }>(`/bom/${id}`, data);
    return response.data.bom_item;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/bom/${id}`);
  },

  calculateRequirements: async (productId: string, quantityToProduce: number) => {
    const response = await apiClient.get(`/bom/product/${productId}/calculate`, {
      params: { quantity_to_produce: quantityToProduce },
    });
    return response.data;
  },

  checkAvailability: async (productId: string, quantityToProduce: number) => {
    const response = await apiClient.get(`/bom/product/${productId}/check-availability`, {
      params: { quantity_to_produce: quantityToProduce },
    });
    return response.data;
  },
};
