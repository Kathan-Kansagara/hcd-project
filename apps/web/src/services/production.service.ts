import apiClient from '../lib/axios';

export interface ProductionBatch {
  product_id: string;
  batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  quantity_produced: number;
  unit: string;
  storage_location?: string;
  notes?: string;
  raw_material_consumptions?: Array<{
    raw_material_batch_id: string;
    quantity_consumed: number;
    unit: string;
  }>;
}

export const productionService = {
  createBatchWithConsumption: async (data: ProductionBatch) => {
    const response = await apiClient.post('/production/batch-with-consumption', data);
    return response.data;
  },

  getBatchTraceability: async (batchId: string) => {
    const response = await apiClient.get(`/production/batch/${batchId}/traceability`);
    return response.data;
  },

  getRawMaterialTraceability: async (rmBatchId: string) => {
    const response = await apiClient.get(`/production/raw-material-batch/${rmBatchId}/traceability`);
    return response.data;
  },
};
