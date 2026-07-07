import { z } from 'zod';
export declare const PlayerResponseSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    createdAt: Date;
}, {
    name: string;
    id: string;
    createdAt: Date;
}>;
export declare const UpdatePlayerBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    password?: string | undefined;
}, {
    name?: string | undefined;
    password?: string | undefined;
}>;
export type PlayerResponse = z.infer<typeof PlayerResponseSchema>;
export type UpdatePlayerBody = z.infer<typeof UpdatePlayerBodySchema>;
//# sourceMappingURL=player.schemas.d.ts.map