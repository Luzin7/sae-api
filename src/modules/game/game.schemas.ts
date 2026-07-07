import { z } from 'zod';

export const CreateGameBodySchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
});

export const UpdateGameBodySchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

export const JoinGameBodySchema = z.object({
  inviteCode: z.string().min(1),
});

export type CreateGameBody = z.infer<typeof CreateGameBodySchema>;
export type UpdateGameBody = z.infer<typeof UpdateGameBodySchema>;
export type JoinGameBody = z.infer<typeof JoinGameBodySchema>;
