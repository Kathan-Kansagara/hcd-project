import apiClient from '../lib/axios';

export interface Payment {
  id: string;
  payment_number: string;
  invoice_id: string;
  customer_id: string;
  payment_date: string;
  amount: number;
  payment_method: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT_CARD' | 'OTHER';
  reference_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  invoice?: {
    id: string;
    invoice_number: string;
    customer: {
      id: string;
      company_name: string;
      client_name?: string;
    };
  };
}

export interface RecordPaymentData {
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'UPI' | 'CREDIT_CARD' | 'OTHER';
  reference_number?: string;
  notes?: string;
}

export interface GetPaymentsParams {
  invoice_id?: string;
  payment_method?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaymentsResponse {
  payments: Payment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const paymentService = {
  async getPayments(params?: GetPaymentsParams): Promise<PaymentsResponse> {
    const response = await apiClient.get<PaymentsResponse>('/payments', { params });
    return response.data;
  },

  async getPaymentById(id: string): Promise<{ payment: Payment }> {
    const response = await apiClient.get<{ payment: Payment }>(`/payments/${id}`);
    return response.data;
  },

  async recordPayment(data: RecordPaymentData): Promise<{ payment: Payment; invoice: any }> {
    const response = await apiClient.post<{ payment: Payment; invoice: any }>('/payments', data);
    return response.data;
  },

  async deletePayment(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/payments/${id}`);
    return response.data;
  },

  async createRazorpayOrder(data: { invoice_id: string }): Promise<{ order_id: string; amount: number; currency: string; key_id: string }> {
    const response = await apiClient.post('/payments/razorpay/create-order', data);
    return response.data;
  },

  async verifyRazorpayPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    invoice_id: string;
    amount?: number;
  }): Promise<{ success: boolean; payment: Payment; invoice: any }> {
    const response = await apiClient.post('/payments/razorpay/verify', data);
    return response.data;
  },

  async getUpiQrData(invoice_id: string): Promise<{
    upi_uri: string;
    upi_id: string;
    payee_name: string;
    amount: number;
    currency: string;
    invoice_number: string;
    customer_name: string;
  }> {
    const response = await apiClient.get('/payments/upi-qr-data', {
      params: { invoice_id },
    });
    return response.data;
  },
};
