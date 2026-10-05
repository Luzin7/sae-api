import { z } from 'zod';

export const GameParamsSchema = z.object({
  gameId: z.string().uuid(),
});

export const SessionLogParamsSchema = z.object({
  gameId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const ListLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GameParams = z.infer<typeof GameParamsSchema>;
export type SessionLogParams = z.infer<typeof SessionLogParamsSchema>;
export type ListLogsQuery = z.infer<typeof ListLogsQuerySchema>;
