import { z } from 'zod';

export const trialSchema = z.object({
  farmer_id: z.string().uuid('Invalid farmer ID'),
  product_id: z.string().uuid('Invalid product ID'),
  crop: z.string().min(1, 'Crop name is required').max(100),
  village: z.string().min(1, 'Village is required').max(100),
  season: z.string().optional(),
  start_date: z.coerce.date(),
  gps_lat: z.number().min(-90).max(90).optional(),
  gps_lng: z.number().min(-180).max(180).optional(),
  with_other_products: z.string().optional(),
});

export const trialCompleteSchema = z.object({
  yield_value: z.number().positive('Yield must be positive').optional(),
  yield_unit: z.string().optional(),
  final_comments: z.string().max(1000).optional(),
});

export type TrialInput = z.infer<typeof trialSchema>;
export type TrialCompleteInput = z.infer<typeof trialCompleteSchema>;
