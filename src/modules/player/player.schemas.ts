import { z } from 'zod';

export const PlayerResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.date(),
});

export const UpdatePlayerBodySchema = z.object({
  name: z.string().min(3).max(100).optional(),
  password: z.string().min(8).max(100).optional(),
});

export type PlayerResponse = z.infer<typeof PlayerResponseSchema>;
export type UpdatePlayerBody = z.infer<typeof UpdatePlayerBodySchema>;
