import apiClient from '../lib/axios';
import type { Trial, PaginatedResponse, PaginationParams } from '../types';

export const trialService = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    farmer_id?: string;
    product_id?: string;
    crop?: string;
    village?: string;
    season?: string;
    start_date_from?: string;
    start_date_to?: string;
    show_archived?: string;
  }) => {
    const response = await apiClient.get<{ trials: Trial[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/trials', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Trial> => {
    const response = await apiClient.get<{ trial: Trial }>(`/trials/${id}`);
    return response.data.trial;
  },

  create: async (data: Partial<Trial>): Promise<Trial> => {
    const response = await apiClient.post<{ trial: Trial }>('/trials', data);
    return response.data.trial;
  },

  update: async (id: string, data: Partial<Trial>): Promise<Trial> => {
    const response = await apiClient.put<Trial>(`/trials/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/trials/${id}`);
  },

  getFilterOptions: async (): Promise<{
    crops: string[];
    seasons: string[];
    villages: string[];
  }> => {
    const response = await apiClient.get('/trials/filter-options');
    return response.data;
  },
};
