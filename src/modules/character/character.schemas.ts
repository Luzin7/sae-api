import { z } from 'zod';

export const CreateCharacterBodySchema = z.object({
  gameId: z.string().uuid(),
  nickname: z.string().min(1).max(150),
  imageUrl: z.string().url().optional(),
  level: z.number().int().min(1).max(20).default(1),
  cognition: z.number().int().min(-5).max(5).default(0),
  psyche: z.number().int().min(-5).max(5).default(0),
  instinct: z.number().int().min(-5).max(5).default(0),
  constitution: z.number().int().min(-5).max(5).default(0),
  motricity: z.number().int().min(-5).max(5).default(0),
  perception: z.number().int().min(-5).max(5).default(0),
  profCognition: z.number().int().min(0).default(0),
  profPsyche: z.number().int().min(0).default(0),
  profInstinct: z.number().int().min(0).default(0),
  profConstitution: z.number().int().min(0).default(0),
  profMotricity: z.number().int().min(0).default(0),
  profPerception: z.number().int().min(0).default(0),
  background: z.string().max(100).optional(),
  profession: z.string().max(100).optional(),
  motivation: z.string().max(100).optional(),
  affliction: z.string().max(100).optional(),
  personality: z.string().max(50).optional(),
  posture: z.string().max(50).optional(),
  hairColor: z.string().max(50).optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  size: z.string().max(30).optional(),
});

export const UpdateCharacterBodySchema = CreateCharacterBodySchema
  .omit({ gameId: true })
  .extend({
    currentHp: z.number().int().optional(),
    currentEffort: z.number().int().optional(),
  })
  .partial();

export const UpdateHpBodySchema = z.object({
  currentHp: z.number().int(),
});

export const UpdateEffortBodySchema = z.object({
  currentEffort: z.number().int(),
});

export const CreateItemBodySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['weapon', 'armor', 'overlay', 'coating', 'accessory', 'consumable', 'misc']),
  slot: z
    .enum(['head', 'torso', 'arms', 'hands', 'legs', 'feet', 'ring_1', 'ring_2', 'external', 'backpack'])
    .default('backpack'),
  description: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  attributes: z.record(z.number()).optional(),
});

export const UpdateItemBodySchema = CreateItemBodySchema.partial();

export const SkillNameEnum = z.enum([
  'knowledge',
  'investigation',
  'medicine',
  'technology',
  'craft',
  'empathy',
  'deception',
  'intimidation',
  'persuasion',
  'presence',
  'acrobatics',
  'stealth',
  'survival_instinct',
  'tactile_perception',
  'reflexes',
  'athletics',
  'endurance',
  'tolerance',
  'vitality',
  'willpower',
  'melee_weapons',
  'firearms',
  'driving',
  'body_stealth',
  'piloting',
  'hearing',
  'smell',
  'taste',
  'touch',
  'vision',
]);

export const UpsertSkillBodySchema = z.object({
  skill: SkillNameEnum,
  points: z.number().int().min(0),
});

export type CreateCharacterBody = z.infer<typeof CreateCharacterBodySchema>;
export type UpdateCharacterBody = z.infer<typeof UpdateCharacterBodySchema>;
export type CreateItemBody = z.infer<typeof CreateItemBodySchema>;
export type UpdateItemBody = z.infer<typeof UpdateItemBodySchema>;
export type SkillName = z.infer<typeof SkillNameEnum>;
export type UpsertSkillBody = z.infer<typeof UpsertSkillBodySchema>;
