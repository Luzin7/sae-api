import { z } from 'zod';
export const RegisterBodySchema = z.object({
    name: z.string().min(3).max(100),
    password: z.string().min(8).max(100),
});
export const LoginBodySchema = z.object({
    name: z.string().min(1),
    password: z.string().min(1),
});
export const AuthResponseSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
});
export const RefreshBodySchema = z.object({
    refreshToken: z.string(),
});
//# sourceMappingURL=auth.schemas.js.map