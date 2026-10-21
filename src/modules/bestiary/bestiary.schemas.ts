import { z } from 'zod';

const AttributeSchema = z.union([
  z.literal(-5),
  z.literal(-4),
  z.literal(-3),
  z.literal(-2),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const SheetFields = {
  name: z.string().min(1).max(150),
  np: z.number().int().min(1).max(20),
  maxHp: z.number().int().positive(),
  maxEffort: z.number().int().positive(),
  currentHp: z.number().int().min(0).optional(),
  currentEffort: z.number().int().min(0).optional(),
  size: z.string().max(30).nullable().optional(),
  cognition: AttributeSchema.default(-5),
  psyche: AttributeSchema.default(-5),
  instinct: AttributeSchema.default(-5),
  constitution: AttributeSchema.default(-5),
  motricity: AttributeSchema.default(-5),
  perception: AttributeSchema.default(-5),
  heightCm: z.number().int().positive().nullable().optional(),
  weightKg: z.number().positive().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
};

export const CreateMonsterBodySchema = z.object({
  gameId: z.string().uuid(),
  ...SheetFields,
});

export const UpdateMonsterBodySchema = CreateMonsterBodySchema.omit({
  gameId: true,
}).partial();

export const BestiaryParamsSchema = z.object({
  id: z.string().min(1),
});

export const BestiaryGameParamsSchema = z.object({
  gameId: z.string().min(1),
});

export type CreateMonsterBody = z.infer<typeof CreateMonsterBodySchema>;
export type UpdateMonsterBody = z.infer<typeof UpdateMonsterBodySchema>;
