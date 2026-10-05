import z from 'zod';

export const UpdatePlayerBodySchema = z.object({
  name: z.string().min(3).max(100),
});

export type UpdatePlayerBody = z.infer<typeof UpdatePlayerBodySchema>;
