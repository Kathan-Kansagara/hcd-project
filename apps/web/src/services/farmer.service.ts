import apiClient from '../lib/axios';
import type { Farmer, PaginatedResponse, PaginationParams } from '../types';

export const farmerService = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; include_archived?: boolean; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    const response = await apiClient.get<{ farmers: Farmer[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/farmers', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Farmer> => {
    const response = await apiClient.get<{ farmer: Farmer }>(`/farmers/${id}`);
    return response.data.farmer;
  },

  getLocations: async (type: 'village' | 'city' | 'taluka' | 'district' | 'state'): Promise<string[]> => {
    const response = await apiClient.get<{ locations: string[] }>(`/farmers/locations/${type}`);
    return response.data.locations;
  },

  getLocationDetails: async (village: string) => {
    const response = await apiClient.get<{ location: { village: string; city: string | null; taluka: string | null; district: string | null; state: string | null; pincode: string | null } }>('/farmers/locations/details', {
      params: { village },
    });
    return response.data;
  },

  create: async (data: Partial<Farmer>): Promise<Farmer> => {
    const response = await apiClient.post<{ farmer: Farmer }>('/farmers', data);
    return response.data.farmer;
  },

  update: async (id: string, data: Partial<Farmer>): Promise<Farmer> => {
    const response = await apiClient.put<{ farmer: Farmer }>(`/farmers/${id}`, data);
    return response.data.farmer;
  },

  archive: async (id: string): Promise<void> => {
    await apiClient.post(`/farmers/${id}/archive`);
  },

  unarchive: async (id: string): Promise<void> => {
    await apiClient.post(`/farmers/${id}/unarchive`);
  },
};
