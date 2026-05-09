import apiClient from '../lib/axios';

export const locationService = {
  // Get all states
  getStates: async (): Promise<string[]> => {
    const response = await apiClient.get<{ states: string[] }>('/location/states');
    return response.data.states;
  },

  // Get districts by state
  getDistricts: async (state: string): Promise<string[]> => {
    const response = await apiClient.get<{ districts: string[] }>('/location/districts', {
      params: { state },
    });
    return response.data.districts;
  },
};
