import { z } from 'zod';

export const farmerSchema = z.object({
  name: z.string().min(1, 'Farmer name is required').max(100),
  village: z.string().min(1, 'Village is required').max(100),
  contact: z.string().optional(),
});

export type FarmerInput = z.infer<typeof farmerSchema>;
