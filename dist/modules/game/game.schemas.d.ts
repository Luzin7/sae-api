import { z } from 'zod';
export declare const CreateGameBodySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
    imageUrl?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    imageUrl?: string | undefined;
}>;
export declare const UpdateGameBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    name?: string | undefined;
    imageUrl?: string | undefined;
    isActive?: boolean | undefined;
}, {
    description?: string | undefined;
    name?: string | undefined;
    imageUrl?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const JoinGameBodySchema: z.ZodObject<{
    inviteCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    inviteCode: string;
}, {
    inviteCode: string;
}>;
export type CreateGameBody = z.infer<typeof CreateGameBodySchema>;
export type UpdateGameBody = z.infer<typeof UpdateGameBodySchema>;
export type JoinGameBody = z.infer<typeof JoinGameBodySchema>;
//# sourceMappingURL=game.schemas.d.ts.map