import { z } from 'zod';
export const StartSessionParamsSchema = z.object({
    gameId: z.string().uuid(),
});
export const EndSessionParamsSchema = z.object({
    gameId: z.string().uuid(),
});
export const GetActiveSessionParamsSchema = z.object({
    gameId: z.string().uuid(),
});
export const SessionResponseSchema = z.object({
    id: z.string().uuid(),
    gameId: z.string().uuid(),
    startedAt: z.date(),
    endedAt: z.date().nullable(),
    isActive: z.boolean(),
});
//# sourceMappingURL=session.schemas.js.map