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

export const GameParamsSchema = z.object({
  id: z.string().min(1),
});

export const GameListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateGameBody = z.infer<typeof CreateGameBodySchema>;
export type UpdateGameBody = z.infer<typeof UpdateGameBodySchema>;
export type JoinGameBody = z.infer<typeof JoinGameBodySchema>;
export type GameListQuery = z.infer<typeof GameListQuerySchema>;
