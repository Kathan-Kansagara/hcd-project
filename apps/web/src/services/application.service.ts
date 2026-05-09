import apiClient from '../lib/axios';
import type { Application, Photo } from '../types';

export const applicationService = {
  create: async (data: Partial<Application>): Promise<Application> => {
    const response = await apiClient.post<{ application: Application }>('/applications', data);
    return response.data.application;
  },

  update: async (id: string, data: Partial<Application>): Promise<Application> => {
    const response = await apiClient.put<{ application: Application }>(`/applications/${id}`, data);
    return response.data.application;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/applications/${id}`);
  },

  uploadPhoto: async (
    applicationId: string,
    file: File,
    stage: 'BEFORE_UNTREATED' | 'AFTER_TREATED'
  ): Promise<Photo> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('stage', stage);

    const response = await apiClient.post<Photo>(
      `/applications/${applicationId}/photos`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  getPhotos: async (applicationId: string): Promise<Photo[]> => {
    const response = await apiClient.get<Photo[]>(`/applications/${applicationId}/photos`);
    return response.data;
  },

  deletePhoto: async (photoId: string): Promise<void> => {
    await apiClient.delete(`/photos/${photoId}`);
  },
};
