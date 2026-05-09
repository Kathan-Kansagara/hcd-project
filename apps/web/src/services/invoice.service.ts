import apiClient from '../lib/axios';

export interface Invoice {
  id: string;
  invoice_number: string;
  sales_order_id: string;
  delivery_note_id: string;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  place_of_supply: string;
  sub_total: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_gst: number;
  round_off: number;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    company_name: string;
    client_name?: string;
  };
  items?: InvoiceItem[];
  sales_order?: {
    id: string;
    so_number: string;
  };
  delivery_note?: {
    id: string;
    dn_number: string;
  };
  payments?: Payment[];
}

export interface InvoiceItem {
  id: string;
  sr_no: number;
  product_name: string;
  hsn_sac_code: string;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
  amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
}

export interface Payment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
}

export interface CreateInvoiceData {
  delivery_note_id?: string;
  sales_order_id?: string;
  invoice_date: string;
  due_date?: string;
  discount_amount?: number;
  discount_percentage?: number;
  payment_terms_days?: number;
  notes?: string;
}

export interface GetInvoicesParams {
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

export interface InvoicesResponse {
  invoices: Invoice[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const invoiceService = {
  async getInvoices(params?: GetInvoicesParams): Promise<InvoicesResponse> {
    const response = await apiClient.get<InvoicesResponse>('/invoices', { params });
    return response.data;
  },

  async getInvoiceById(id: string): Promise<{ invoice: Invoice }> {
    const response = await apiClient.get<{ invoice: Invoice }>(`/invoices/${id}`);
    return response.data;
  },

  async getInvoiceByNumber(invoiceNumber: string): Promise<{ invoice: Invoice }> {
    const response = await apiClient.get<{ invoice: Invoice }>(`/invoices/lookup/${encodeURIComponent(invoiceNumber)}`);
    return response.data;
  },

  async createInvoice(data: CreateInvoiceData): Promise<{ invoice: Invoice }> {
    const response = await apiClient.post<{ invoice: Invoice }>('/invoices', data);
    return response.data;
  },

  async updateInvoice(id: string, data: Partial<CreateInvoiceData> & { status?: string }): Promise<{ invoice: Invoice }> {
    const response = await apiClient.put<{ invoice: Invoice }>(`/invoices/${id}`, data);
    return response.data;
  },

  async downloadInvoicePDF(id: string, invoiceNumber: string): Promise<void> {
    const response = await apiClient.get(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    });

    // Create a blob URL and trigger download
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
