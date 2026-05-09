import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';

export interface ApiError extends Error {
  status?: number;
  errors?: any;
}

export function errorHandler(err: ApiError, req: Request, res: Response, next: NextFunction) {
  logger.error('Error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack, details: err.errors }),
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' });
}
