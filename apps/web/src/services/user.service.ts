import apiClient from '../lib/axios';
import type { User } from '../types';

export const userService = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; role?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    const response = await apiClient.get<{ users: User[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/users', { params });
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await apiClient.get<{ user: User }>(`/users/${id}`);
    return response.data.user;
  },

  create: async (data: { email: string; password: string; name: string; role?: 'ADMIN' | 'SUBADMIN'; permissions?: string[] }): Promise<User> => {
    const response = await apiClient.post<{ user: User }>('/users', data);
    return response.data.user;
  },

  update: async (id: string, data: { email?: string; name?: string; role?: 'ADMIN' | 'SUBADMIN'; password?: string; permissions?: string[] }): Promise<User> => {
    const response = await apiClient.put<{ user: User }>(`/users/${id}`, data);
    return response.data.user;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },
};
