import { z } from 'zod';

/** Same scale as the rules catalog: −1 and 0 are not valid attribute values. */
const AttributeValueSchema = z.union([
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

export const RollInputSchema = z.object({
  attribute: z.string().min(1),
  attrValue: AttributeValueSchema,
  skillBonus: z.number().int().default(0),
  bExp: z.number().int().min(0).default(0),
});

export const RollResultSchema = z.object({
  attribute: z.string(),
  rolls: z.array(z.number()),
  result: z.number(),
  kind: z.enum(['best', 'worst', 'single']),
  skillBonus: z.number(),
  bExp: z.number(),
  total: z.number(),
});

export type RollInput = z.infer<typeof RollInputSchema>;
export type RollResult = z.infer<typeof RollResultSchema>;
