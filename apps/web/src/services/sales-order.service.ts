import apiClient from '../lib/axios';

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  raw_material_id: string;
  batch_id: string;
  product_name: string;
  hsn_sac_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  gst_rate: number;
  amount: number;
  gst_amount: number;
  total_amount: number;
  raw_material?: {
    id: string;
    code: string;
    name: string;
    category: string;
    unit: string;
  };
  batch?: {
    id: string;
    batch_number: string;
    quantity_remaining: number;
  };
}

export interface SalesOrder {
  id: string;
  so_number: string;
  sale_type: 'company' | 'individual';
  customer_id: string;
  order_date: string;
  expected_delivery_date?: string;
  status: 'DRAFT' | 'PENDING' | 'DELIVERED' | 'CANCELLED';
  payment_method?: 'CASH' | 'UPI' | 'CREDIT_CARD' | 'CHEQUE' | 'BANK_TRANSFER' | 'OTHER';
  discount_amount: number;
  discount_percentage: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  customer_rel?: {
    id: string;
    customer_type?: 'company' | 'individual';
    company_name: string;
    client_name?: string;
    contact?: string;
    email?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    place_of_supply?: string;
    payment_terms?: string;
  };
  items?: SalesOrderItem[];
  invoices?: {
    id: string;
    invoice_number: string;
    status: string;
  }[];
  sub_total?: number;
  total_gst?: number;
  grand_total?: number;
}

export interface CreateSalesOrderInput {
  sale_type?: 'company' | 'individual';
  customer_id: string;
  order_date: string;
  expected_delivery_date?: string;
  payment_method?: string;
  discount_amount?: number;
  discount_percentage?: number;
  items: {
    raw_material_id: string;
    batch_id: string;
    quantity: number;
    unit_price: number;
    gst_rate: number;
  }[];
  notes?: string;
}

export interface GetSalesOrdersParams {
  customer_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SalesOrdersResponse {
  salesOrders: SalesOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const salesOrderService = {
  async getSalesOrders(params?: GetSalesOrdersParams): Promise<SalesOrdersResponse> {
    const response = await apiClient.get<SalesOrdersResponse>('/sales-orders', { params });
    return response.data;
  },

  async getSalesOrderById(id: string): Promise<{ salesOrder: SalesOrder }> {
    const response = await apiClient.get<{ salesOrder: SalesOrder }>(`/sales-orders/${id}`);
    return response.data;
  },

  async createSalesOrder(data: CreateSalesOrderInput): Promise<{ salesOrder: SalesOrder }> {
    const response = await apiClient.post<{ salesOrder: SalesOrder }>('/sales-orders', data);
    return response.data;
  },

  async updateSalesOrder(
    id: string,
    data: Partial<CreateSalesOrderInput>
  ): Promise<{ salesOrder: SalesOrder }> {
    const response = await apiClient.put<{ salesOrder: SalesOrder }>(`/sales-orders/${id}`, data);
    return response.data;
  },

  async cancelSalesOrder(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/sales-orders/${id}/cancel`);
    return response.data;
  },

  async markDelivered(id: string): Promise<{ salesOrder: SalesOrder }> {
    const response = await apiClient.put<{ salesOrder: SalesOrder }>(`/sales-orders/${id}/mark-delivered`);
    return response.data;
  },
};

// Delivery Note types and service
export interface DeliveryNoteItem {
  id: string;
  delivery_note_id: string;
  sales_order_item_id: string;
  raw_material_id: string;
  batch_id: string;
  quantity_delivered: number;
  unit: string;
  raw_material?: {
    id: string;
    code: string;
    name: string;
  };
  batch?: {
    id: string;
    batch_number: string;
  };
}

export interface DeliveryNote {
  id: string;
  dn_number: string;
  sales_order_id: string;
  customer_id: string;
  delivery_date: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  customer_rel?: {
    id: string;
    company_name: string;
    client_name?: string;
  };
  sales_order?: {
    id: string;
    so_number: string;
  };
  items?: DeliveryNoteItem[];
}

export interface CreateDeliveryNoteInput {
  sales_order_id: string;
  delivery_date: string;
  items: {
    sales_order_item_id: string;
    quantity_delivered?: number;
  }[];
  notes?: string;
}

export interface GetDeliveryNotesParams {
  sales_order_id?: string;
  customer_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

export interface DeliveryNotesResponse {
  deliveryNotes: DeliveryNote[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const deliveryNoteService = {
  async getDeliveryNotes(params?: GetDeliveryNotesParams): Promise<DeliveryNotesResponse> {
    const response = await apiClient.get<DeliveryNotesResponse>('/delivery-notes', { params });
    return response.data;
  },

  async getDeliveryNoteById(id: string): Promise<{ deliveryNote: DeliveryNote }> {
    const response = await apiClient.get<{ deliveryNote: DeliveryNote }>(`/delivery-notes/${id}`);
    return response.data;
  },

  async createDeliveryNote(data: CreateDeliveryNoteInput): Promise<{ deliveryNote: DeliveryNote }> {
    const response = await apiClient.post<{ deliveryNote: DeliveryNote }>('/delivery-notes', data);
    return response.data;
  },
};
