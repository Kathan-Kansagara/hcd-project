import apiClient from '../lib/axios';

export type POStatus = 'DRAFT' | 'PENDING' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  raw_material_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  batch_id?: string;
  raw_material?: {
    id: string;
    name: string;
    category: string;
  };
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  order_date: string;
  expected_delivery_date?: string;
  status: POStatus;
  payment_method?: 'CASH' | 'UPI' | 'CREDIT_CARD' | 'CHEQUE' | 'BANK_TRANSFER' | 'OTHER';
  sub_total: number;
  total_amount: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  supplier?: {
    id: string;
    company_name: string;
    contact_person?: string;
    contact: string;
  };
  items?: PurchaseOrderItem[];
}

export type CreatePurchaseOrderData = {
  supplier_id: string;
  order_date: string;
  expected_delivery_date?: string;
  payment_method?: string;
  notes?: string;
  items: Array<{
    raw_material_id: string;
    quantity: number;
    unit: string;
    unit_price: number;
  }>;
};

export type UpdatePurchaseOrderData = Partial<CreatePurchaseOrderData>;

export interface PurchaseOrderListResponse {
  purchase_orders: PurchaseOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const purchaseOrderService = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    supplier_id?: string;
    status?: POStatus;
    start_date?: string;
    end_date?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PurchaseOrderListResponse> => {
    const response = await apiClient.get<PurchaseOrderListResponse>('/purchase-orders', { params });
    return response.data;
  },

  getById: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.get<{ purchase_order: PurchaseOrder }>(`/purchase-orders/${id}`);
    return response.data.purchase_order;
  },

  create: async (data: CreatePurchaseOrderData): Promise<PurchaseOrder> => {
    const response = await apiClient.post<{ purchase_order: PurchaseOrder }>('/purchase-orders', data);
    return response.data.purchase_order;
  },

  update: async (id: string, data: UpdatePurchaseOrderData): Promise<PurchaseOrder> => {
    const response = await apiClient.put<{ purchase_order: PurchaseOrder }>(`/purchase-orders/${id}`, data);
    return response.data.purchase_order;
  },

  markReceived: async (id: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post<{ purchase_order: PurchaseOrder }>(`/purchase-orders/${id}/mark-received`);
    return response.data.purchase_order;
  },

  cancel: async (id: string): Promise<void> => {
    await apiClient.delete(`/purchase-orders/${id}/cancel`);
  },
};
