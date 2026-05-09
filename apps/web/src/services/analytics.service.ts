import apiClient from '../lib/axios';

export interface InventoryAnalytics {
  total_raw_materials: number;
  low_stock_items: number;
  total_stock_value: number;
  recent_movements: number;
  movements_by_type: Array<{
    type: string;
    count: number;
    total_quantity: number;
  }>;
}

export interface SalesAnalytics {
  total_orders: number;
  orders_by_status: Array<{
    status: string;
    count: number;
    total_value: number;
  }>;
  total_revenue: number;
  total_paid: number;
  total_outstanding: number;
  top_customers: Array<{
    customer_id: string;
    customer_name: string;
    total_revenue: number;
  }>;
}

export interface PurchaseAnalytics {
  total_purchase_orders: number;
  pos_by_status: Array<{
    status: string;
    count: number;
    total_value: number;
  }>;
  total_purchase_value: number;
  top_suppliers: Array<{
    supplier_id: string;
    supplier_name: string;
    total_purchase: number;
  }>;
}

export interface InventoryProductionOverview {
  summary: {
    total_products: number;
    total_raw_materials: number;
    total_finished_batches: number;
    total_rm_batches: number;
    total_finished_stock: number;
    total_produced_stock: number;
    total_rm_stock_value: number;
    low_stock_rm_count: number;
    expiring_finished_count: number;
    expiring_rm_count: number;
    products_with_bom: number;
  };
  charts: {
    production_trend: Array<{ month: string; batches_count: number; total_quantity: number }>;
    stock_by_product: Array<{ product: string; remaining: number; produced: number; batches: number }>;
    rm_stock_levels: Array<{ name: string; code: string; stock: number; min_level: number; value: number; unit: string }>;
    rm_by_category: Array<{ category: string; count: number; value: number }>;
    movements_trend: Array<{ month: string; PURCHASE: number; SALE: number; ADJUSTMENT: number; PRODUCTION_CONSUMPTION: number; total: number }>;
  };
  alerts: {
    low_stock_raw_materials: Array<{ id: string; name: string; code: string; current_stock: number; min_level: number; unit: string }>;
    expiring_finished_batches: Array<{ id: string; batch_number: string; product_name: string; expiry_date: string; quantity_remaining: number }>;
    expiring_rm_batches: Array<{ id: string; batch_number: string; rm_name: string; rm_code: string; expiry_date: string; quantity_remaining: number }>;
  };
  recent_production: Array<{ id: string; batch_number: string; product_name: string; manufacturing_date: string; quantity_produced: number; quantity_remaining: number; unit: string; created_at: string }>;
}

export interface SalesCustomerOverview {
  summary: {
    total_revenue: number;
    total_collected: number;
    total_outstanding: number;
    collection_rate: number;
    total_sales_orders: number;
    active_customers: number;
    avg_order_value: number;
    overdue_invoices: number;
    high_risk_count: number;
  };
  charts: {
    revenue_vs_collections: Array<{
      month: string;
      revenue: number;
      collections: number;
      cumulative_revenue: number;
      cumulative_collections: number;
    }>;
    cash_flow: Array<{
      month: string;
      cash_in: number;
      cash_out: number;
      net: number;
    }>;
    sales_order_trend: Array<{
      month: string;
      order_count: number;
      order_value: number;
    }>;
    invoice_status_distribution: Array<{
      status: string;
      count: number;
      total_value: number;
    }>;
    payment_method_distribution: Array<{
      method: string;
      count: number;
      total_amount: number;
    }>;
    customer_trend: Array<{
      month: string;
      new_customers: number;
    }>;
    top_performers: Array<{
      customer_id: string;
      customer_name: string;
      total_revenue: number;
      total_collected: number;
      collection_rate: number;
      order_count: number;
      invoice_count: number;
    }>;
  };
  tables: {
    top_customers: Array<{
      customer_id: string;
      customer_name: string;
      total_revenue: number;
      total_paid: number;
      total_outstanding: number;
      order_count: number;
    }>;
    overdue_invoices: Array<{
      id: string;
      invoice_number: string;
      customer_name: string;
      grand_total: number;
      amount_due: number;
      due_date: string;
      days_overdue: number;
    }>;
    recent_payments: Array<{
      id: string;
      payment_number: string;
      customer_name: string;
      amount: number;
      payment_method: string;
      payment_date: string;
    }>;
    high_risk_customers: Array<{
      customer_id: string;
      customer_name: string;
      total_revenue: number;
      total_collected: number;
      outstanding: number;
      collection_rate: number;
      overdue_count: number;
      overdue_amount: number;
      max_days_overdue: number;
      risk_score: number;
      risk_level: 'critical' | 'high' | 'medium' | 'low';
      reasons: string[];
    }>;
  };
}

export interface RevenueTimeSeries {
  time_series: Array<{
    date: string;
    total_revenue: number;
    paid_revenue: number;
    invoice_count: number;
  }>;
}

export const analyticsService = {
  async getInventoryAnalytics(period: number = 30): Promise<InventoryAnalytics> {
    const response = await apiClient.get<InventoryAnalytics>(
      `/dashboard/analytics/inventory?period=${period}`
    );
    return response.data;
  },

  async getSalesAnalytics(period: number = 30): Promise<SalesAnalytics> {
    const response = await apiClient.get<SalesAnalytics>(
      `/dashboard/analytics/sales?period=${period}`
    );
    return response.data;
  },

  async getPurchaseAnalytics(period: number = 30): Promise<PurchaseAnalytics> {
    const response = await apiClient.get<PurchaseAnalytics>(
      `/dashboard/analytics/purchases?period=${period}`
    );
    return response.data;
  },

  async getInventoryProductionOverview(period: number = 90): Promise<InventoryProductionOverview> {
    const response = await apiClient.get<InventoryProductionOverview>(
      `/dashboard/analytics/inventory-production-overview?period=${period}`
    );
    return response.data;
  },

  async getRevenueTimeSeries(period: number = 30): Promise<RevenueTimeSeries> {
    const response = await apiClient.get<RevenueTimeSeries>(
      `/dashboard/analytics/revenue-time-series?period=${period}`
    );
    return response.data;
  },

  async getSalesCustomerOverview(fromDate: string, toDate: string): Promise<SalesCustomerOverview> {
    const response = await apiClient.get<SalesCustomerOverview>(
      `/dashboard/analytics/sales-customer-overview?from_date=${fromDate}&to_date=${toDate}`
    );
    return response.data;
  },
};
