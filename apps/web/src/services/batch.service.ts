import apiClient from '../lib/axios';

export interface Batch {
  id: string;
  product_id: string;
  batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  quantity_produced: number;
  quantity_remaining: number;
  unit: string;
  storage_location?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
  };
  expiry_status?: string;
  days_until_expiry?: number;
  applications_count?: number;
}

export interface CreateBatchData {
  product_id: string;
  batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  quantity_produced: number;
  unit: string;
  storage_location?: string;
  notes?: string;
}

export interface UpdateBatchData {
  batch_number?: string;
  manufacturing_date?: string;
  expiry_date?: string;
  quantity_produced?: number;
  quantity_remaining?: number;
  unit?: string;
  storage_location?: string;
  notes?: string;
  is_active?: boolean;
}

export const batchService = {
  async getAll(params?: {
    search?: string;
    product_id?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const response = await apiClient.get('/batches', { params });
    return response.data;
  },

  async getById(id: string) {
    const response = await apiClient.get(`/batches/${id}`);
    return response.data.batch;
  },

  async getByProduct(productId: string) {
    const response = await apiClient.get(`/batches/product/${productId}`);
    return response.data.batches;
  },

  async create(data: CreateBatchData) {
    const response = await apiClient.post('/batches', data);
    return response.data.batch;
  },

  async update(id: string, data: UpdateBatchData) {
    const response = await apiClient.put(`/batches/${id}`, data);
    return response.data.batch;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/batches/${id}`);
    return response.data;
  },
};
