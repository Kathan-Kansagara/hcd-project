import { z } from 'zod';

export const applicationSchema = z.object({
  app_type: z.enum(['DRIP', 'IRRIGATION', 'SPRAY']),
  app_date: z.coerce.date(),
});

export const commentSchema = z.object({
  stage: z.enum(['BEFORE_UNTREATED', 'AFTER_TREATED']),
  comment_text: z.string().min(1).max(500),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
