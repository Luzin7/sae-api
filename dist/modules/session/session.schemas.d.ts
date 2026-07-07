import { z } from 'zod';
export declare const StartSessionParamsSchema: z.ZodObject<{
    gameId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    gameId: string;
}, {
    gameId: string;
}>;
export declare const EndSessionParamsSchema: z.ZodObject<{
    gameId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    gameId: string;
}, {
    gameId: string;
}>;
export declare const GetActiveSessionParamsSchema: z.ZodObject<{
    gameId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    gameId: string;
}, {
    gameId: string;
}>;
export declare const SessionResponseSchema: z.ZodObject<{
    id: z.ZodString;
    gameId: z.ZodString;
    startedAt: z.ZodDate;
    endedAt: z.ZodNullable<z.ZodDate>;
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
    gameId: string;
    startedAt: Date;
    endedAt: Date | null;
}, {
    id: string;
    isActive: boolean;
    gameId: string;
    startedAt: Date;
    endedAt: Date | null;
}>;
export type StartSessionParams = z.infer<typeof StartSessionParamsSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
//# sourceMappingURL=session.schemas.d.ts.map