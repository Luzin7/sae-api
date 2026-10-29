import { z } from 'zod';
import { AFFLICTION_KEYS } from '@shared/rules/afflictions.js';
import { EffortDeltaSchema } from '@shared/rules/effort.js';
import { HpDeltaSchema } from '@shared/rules/hp.js';
import { SKILLS } from '@shared/rules/skills.js';
import {
  HEIGHT_EXACT_MAX,
  HEIGHT_EXACT_MIN,
  WEIGHT_EXACT_MAX,
  WEIGHT_EXACT_MIN,
} from '@shared/rules/size.js';

const HEIGHT_RANGE_MESSAGE = `Altura deve estar entre ${HEIGHT_EXACT_MIN} e ${HEIGHT_EXACT_MAX} cm.`;
const WEIGHT_RANGE_MESSAGE = `Peso deve estar entre ${WEIGHT_EXACT_MIN} e ${WEIGHT_EXACT_MAX} kg.`;

const AFFLICTION_MESSAGE = 'Aflição inválida.';
const DUPLICATE_SKILL_MESSAGE = 'Perícia repetida.';
const DUPLICATE_AFFLICTION_MESSAGE = 'Aflição repetida.';
const WEIGHT_INTEGER_MESSAGE = 'Peso deve ser um número inteiro.';

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
  heightCm: z
    .number()
    .int()
    .min(HEIGHT_EXACT_MIN, HEIGHT_RANGE_MESSAGE)
    .max(HEIGHT_EXACT_MAX, HEIGHT_RANGE_MESSAGE)
    .optional(),
  heightRoll: z.enum(['min', 'max']).optional(),
  weightKg: z
    .number()
    .int(WEIGHT_INTEGER_MESSAGE)
    .min(WEIGHT_EXACT_MIN, WEIGHT_RANGE_MESSAGE)
    .max(WEIGHT_EXACT_MAX, WEIGHT_RANGE_MESSAGE)
    .optional(),
  weightRoll: z.enum(['min', 'max']).optional(),
  background: z.string().max(2000).optional(),
  profession: z.string().max(100).optional(),
  motivation: z.string().max(1000).optional(),
  afflictions: z
    .array(z.enum(AFFLICTION_KEYS, { message: AFFLICTION_MESSAGE }))
    .max(AFFLICTION_KEYS.length)
    .optional(),
  personality: z.string().min(1).max(50),
  posture: z.string().min(1).max(50),
  socialClass: SocialClassSchema,
  bonds: z.string().max(2000).optional(),
};

export const UpsertSkillBodySchema = z.object({
  skillId: z.string().uuid(),
  proficiencyBonus: z.number().int().min(0),
});

const SkillAllocationsSchema = z
  .array(UpsertSkillBodySchema)
  .max(SKILLS.length);

const CharacterSheetBodySchema = z.object({
  gameId: z.string().uuid(),
  ...SheetFields,
});

interface SizeSources {
  heightCm?: number;
  heightRoll?: 'min' | 'max';
  weightKg?: number;
  weightRoll?: 'min' | 'max';
}

interface SizeSourceRule {
  exact: 'heightCm' | 'weightKg';
  roll: 'heightRoll' | 'weightRoll';
  missingMessage: string;
  conflictMessage: string;
}

const SIZE_SOURCE_RULES: readonly SizeSourceRule[] = [
  {
    exact: 'heightCm',
    roll: 'heightRoll',
    missingMessage: 'Informe a altura ou escolha rolar.',
    conflictMessage: 'Informe a altura ou a rolagem, não as duas.',
  },
  {
    exact: 'weightKg',
    roll: 'weightRoll',
    missingMessage: 'Informe o peso ou escolha rolar.',
    conflictMessage: 'Informe o peso ou a rolagem, não as duas.',
  },
];

function assertSizeSource(
  input: SizeSources,
  rule: SizeSourceRule,
  required: boolean,
  ctx: z.RefinementCtx,
): void {
  const hasExact = input[rule.exact] !== undefined;
  const hasRoll = input[rule.roll] !== undefined;

  if (hasExact && hasRoll) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [rule.exact],
      message: rule.conflictMessage,
    });
    return;
  }

  if (required && !hasExact && !hasRoll) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [rule.exact],
      message: rule.missingMessage,
    });
  }
}

function refineSizeSources(required: boolean) {
  return (input: SizeSources, ctx: z.RefinementCtx): void => {
    for (const rule of SIZE_SOURCE_RULES) {
      assertSizeSource(input, rule, required, ctx);
    }
  };
}

function refineUniqueSkills(
  input: { skills?: { skillId: string }[] },
  ctx: z.RefinementCtx,
): void {
  const ids = (input.skills ?? []).map((skill) => skill.skillId);
  if (new Set(ids).size === ids.length) return;

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['skills'],
    message: DUPLICATE_SKILL_MESSAGE,
  });
}

function refineUniqueAfflictions(
  input: { afflictions?: string[] },
  ctx: z.RefinementCtx,
): void {
  const afflictions = input.afflictions ?? [];
  if (new Set(afflictions).size === afflictions.length) return;

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['afflictions'],
    message: DUPLICATE_AFFLICTION_MESSAGE,
  });
}

export const CreateCharacterBodySchema = CharacterSheetBodySchema.omit({
  np: true,
})
  .extend({
    clientRequestId: z.string().uuid(),
    skills: SkillAllocationsSchema.default([]),
  })
  .superRefine(refineSizeSources(true))
  .superRefine(refineUniqueSkills)
  .superRefine(refineUniqueAfflictions);

const UpdateCharacterSheetBodySchema = CharacterSheetBodySchema.omit({
  gameId: true,
})
  .partial()
  .extend({ version: z.number().int().min(0) });

export const UpdateCharacterBodySchema =
  UpdateCharacterSheetBodySchema.superRefine(
    refineSizeSources(false),
  ).superRefine(refineUniqueAfflictions);

export const PreviewCharacterBodySchema = CharacterSheetBodySchema.pick({
  np: true,
  cognition: true,
  psyche: true,
  instinct: true,
  constitution: true,
  motricity: true,
  perception: true,
  personality: true,
  posture: true,
  heightCm: true,
  heightRoll: true,
  weightKg: true,
  weightRoll: true,
  socialClass: true,
})
  .partial()
  .extend({
    np: CharacterSheetBodySchema.shape.np,
    skills: SkillAllocationsSchema.optional(),
  })
  .superRefine(refineSizeSources(false))
  .superRefine(refineUniqueSkills);

export const ChangeHpBodySchema = z.object({
  delta: HpDeltaSchema,
});

export const ChangeEffortBodySchema = z.object({
  delta: EffortDeltaSchema,
});

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
export type PreviewCharacterBody = z.infer<typeof PreviewCharacterBodySchema>;
export type UpdateCharacterBody = z.infer<typeof UpdateCharacterBodySchema>;
export type ChangeHpBody = z.infer<typeof ChangeHpBodySchema>;
export type ChangeEffortBody = z.infer<typeof ChangeEffortBodySchema>;
export type CreateItemBody = z.infer<typeof CreateItemBodySchema>;
export type UpdateItemBody = z.infer<typeof UpdateItemBodySchema>;
export type UpsertSkillBody = z.infer<typeof UpsertSkillBodySchema>;
export type CharacterListQuery = z.infer<typeof CharacterListQuerySchema>;
