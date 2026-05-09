import apiClient from '../lib/axios';

export interface RMBatch {
  id: string;
  raw_material_id: string;
  batch_number: string;
  receipt_date: string;
  expiry_date?: string;
  quantity_received: number;
  quantity_remaining: number;
  unit: string;
  storage_location?: string;
  quality_parameters?: any;
  quality_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  raw_material?: {
    id: string;
    code: string;
    name: string;
    category: string;
  };
}

interface RMBatchesResponse {
  rm_batches: RMBatch[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const rmBatchService = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    raw_material_id?: string;
    quality_status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<RMBatchesResponse> => {
    const response = await apiClient.get<RMBatchesResponse>('/raw-material-batches', { params });
    return response.data;
  },

  getById: async (id: string): Promise<RMBatch> => {
    const response = await apiClient.get<{ rm_batch: RMBatch }>(`/raw-material-batches/${id}`);
    return response.data.rm_batch;
  },

  getAvailable: async (rawMaterialId: string) => {
    const response = await apiClient.get(`/raw-material-batches/raw-material/${rawMaterialId}/available`);
    return response.data;
  },

  create: async (data: Partial<RMBatch>): Promise<RMBatch> => {
    const response = await apiClient.post<{ rm_batch: RMBatch }>('/raw-material-batches', data);
    return response.data.rm_batch;
  },

  update: async (id: string, data: Partial<RMBatch>): Promise<RMBatch> => {
    const response = await apiClient.put<{ rm_batch: RMBatch }>(`/raw-material-batches/${id}`, data);
    return response.data.rm_batch;
  },

  adjustStock: async (id: string, quantity_adjustment: number, reason: string) => {
    const response = await apiClient.put(`/raw-material-batches/${id}/adjust-stock`, {
      quantity_adjustment,
      reason,
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/raw-material-batches/${id}`);
  },
};
