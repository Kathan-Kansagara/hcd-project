export const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export const UPLOAD_MAX_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;
