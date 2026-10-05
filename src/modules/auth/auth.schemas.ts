import { z } from 'zod';

export const RegisterBodySchema = z.object({
  name: z.string().min(3).max(100),
  password: z.string().min(8).max(100),
});

export const LoginBodySchema = z.object({
  name: z.string().min(1),
  password: z.string().min(1),
});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
