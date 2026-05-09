import apiClient from '../lib/axios';
import type { Product, PaginatedResponse } from '../types';

interface ProductsResponse {
  products: Product[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const productService = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<ProductsResponse> => {
    const response = await apiClient.get<ProductsResponse>('/products', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Product> => {
    const response = await apiClient.get<{ product: Product }>(`/products/${id}`);
    return response.data.product;
  },

  getCategories: async (): Promise<string[]> => {
    const response = await apiClient.get<{ categories: string[] }>('/products/categories/list');
    return response.data.categories;
  },

  create: async (data: Partial<Product>): Promise<Product> => {
    const response = await apiClient.post<{ product: Product }>('/products', data);
    return response.data.product;
  },

  update: async (id: string, data: Partial<Product>): Promise<Product> => {
    const response = await apiClient.put<{ product: Product }>(`/products/${id}`, data);
    return response.data.product;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/products/${id}`);
  },
};
