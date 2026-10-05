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

const SocialClassSchema = z.enum([
  'opulento',
  'abastado',
  'plebeu',
  'miseravel',
]);

const SheetFields = {
  nickname: z.string().min(1).max(150),
  epithet: z.string().max(100).optional(),
  np: z.number().int().min(1).max(20).default(1),
  cognition: AttributeSchema.default(-5),
  psyche: AttributeSchema.default(-5),
  instinct: AttributeSchema.default(-5),
  constitution: AttributeSchema.default(-5),
  motricity: AttributeSchema.default(-5),
  perception: AttributeSchema.default(-5),
  hairColor: z.string().max(50).optional(),
  heightCm: z.number().int().positive().optional(),
  weightKg: z.number().positive().optional(),
  background: z.string().max(2000).optional(),
  profession: z.string().max(100).optional(),
  motivation: z.string().max(1000).optional(),
  affliction: z.string().max(1000).optional(),
  personality: z.string().min(1).max(50),
  posture: z.string().min(1).max(50),
  socialClass: SocialClassSchema,
  bonds: z.string().max(2000).optional(),
};

export const CreateCharacterBodySchema = z.object({
  gameId: z.string().uuid(),
  ...SheetFields,
});

export const UpdateCharacterBodySchema = CreateCharacterBodySchema.omit({
  gameId: true,
}).partial();

export const UpdateVitalsBodySchema = z
  .object({
    currentHp: z.number().int().min(0).optional(),
    currentEffort: z.number().int().min(0).optional(),
  })
  .refine(
    (value) =>
      value.currentHp !== undefined || value.currentEffort !== undefined,
    { message: 'Informe currentHp ou currentEffort.' },
  );

export const CreateItemBodySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    'weapon',
    'armor',
    'overlay',
    'coating',
    'accessory',
    'consumable',
    'misc',
  ]),
  slot: z
    .enum([
      'head',
      'torso',
      'arms',
      'hands',
      'legs',
      'feet',
      'ring_1',
      'ring_2',
      'external',
      'backpack',
    ])
    .default('backpack'),
  equipped: z.boolean().default(false),
  description: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  attributes: z.record(z.number()).optional(),
});

export const UpdateItemBodySchema = CreateItemBodySchema.partial();

export const UpsertSkillBodySchema = z.object({
  skillId: z.string().uuid(),
  proficiencyBonus: z.number().int().min(0),
});

export const CharacterParamsSchema = z.object({
  id: z.string().min(1),
});

export const CharacterItemParamsSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
});

export const CharacterGameParamsSchema = z.object({
  gameId: z.string().min(1),
});

export const CharacterListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateCharacterBody = z.infer<typeof CreateCharacterBodySchema>;
export type UpdateCharacterBody = z.infer<typeof UpdateCharacterBodySchema>;
export type UpdateVitalsBody = z.infer<typeof UpdateVitalsBodySchema>;
export type CreateItemBody = z.infer<typeof CreateItemBodySchema>;
export type UpdateItemBody = z.infer<typeof UpdateItemBodySchema>;
export type UpsertSkillBody = z.infer<typeof UpsertSkillBodySchema>;
export type CharacterListQuery = z.infer<typeof CharacterListQuerySchema>;
