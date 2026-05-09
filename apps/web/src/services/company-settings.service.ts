import apiClient from '../lib/axios';

export interface CompanySettings {
  id: string;
  company_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  fssai_number?: string;
  bank_name: string;
  bank_account_number: string;
  ifsc_code: string;
  invoice_terms_and_conditions: string;
  invoice_prefix: string;
  logo_path?: string;
  created_at: string;
  updated_at: string;
}

export type UpdateCompanySettingsPayload = Partial<
  Omit<CompanySettings, 'id' | 'created_at' | 'updated_at'>
>;

export const companySettingsService = {
  async getSettings(): Promise<CompanySettings> {
    const response = await apiClient.get('/company-settings');
    return response.data;
  },

  async updateSettings(data: UpdateCompanySettingsPayload): Promise<CompanySettings> {
    const response = await apiClient.put('/company-settings', data);
    return response.data;
  },
};
