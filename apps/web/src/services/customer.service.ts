import apiClient from '../lib/axios';

export interface Customer {
  id: string;
  customer_type: 'company' | 'individual';
  company_name: string;
  client_name?: string;
  contact: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  district?: string;
  pincode?: string;
  gstin?: string;
  place_of_supply?: string;
  payment_terms: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateCustomerData = {
  customer_type?: 'company' | 'individual';
  company_name: string;
  client_name?: string;
  contact: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  district?: string;
  pincode?: string;
  gstin?: string;
  place_of_supply?: string;
  payment_terms?: string;
};

export type UpdateCustomerData = Partial<CreateCustomerData>;

export interface CustomerListResponse {
  customers: Customer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const customerService = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; customer_type?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<CustomerListResponse> => {
    const response = await apiClient.get<CustomerListResponse>('/customers', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Customer> => {
    const response = await apiClient.get<{ customer: Customer }>(`/customers/${id}`);
    return response.data.customer;
  },

  create: async (data: CreateCustomerData): Promise<Customer> => {
    const response = await apiClient.post<{ customer: Customer }>('/customers', data);
    return response.data.customer;
  },

  update: async (id: string, data: UpdateCustomerData): Promise<Customer> => {
    const response = await apiClient.put<{ customer: Customer }>(`/customers/${id}`, data);
    return response.data.customer;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/customers/${id}`);
  },
};
