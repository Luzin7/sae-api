import { z } from 'zod';

export const DiceRollBodySchema = z.object({
  attribute: z.string().min(1),
  attrValue: z.number().int().min(-5).max(5),
  skillBonus: z.number().int().default(0),
  bExp: z.number().int().min(0).default(0),
});

export const DiceRollResponseSchema = z.object({
  attribute: z.string(),
  rolls: z.array(z.number()),
  result: z.number(),
  kind: z.enum(['best', 'worst', 'single']),
  skillBonus: z.number(),
  bExp: z.number(),
  total: z.number(),
});

export type DiceRollBody = z.infer<typeof DiceRollBodySchema>;
export type DiceRollResponse = z.infer<typeof DiceRollResponseSchema>;
