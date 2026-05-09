import apiClient from '../lib/axios';

export const profileService = {
  getProfile: async () => {
    const response = await apiClient.get('/profile');
    return response.data;
  },

  updateProfile: async (data: { name?: string; email?: string }) => {
    const response = await apiClient.put('/profile', data);
    return response.data;
  },

  updatePassword: async (data: { current_password: string; new_password: string }) => {
    const response = await apiClient.put('/profile/password', data);
    return response.data;
  },
};
