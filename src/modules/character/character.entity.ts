import type { ProficiencyLevel } from '@shared/rules/proficiency.js';
import type { SocialClassKey } from '@shared/rules/social-classes.js';

export type { ProficiencyLevel };

export type AttributeName =
  | 'cognition'
  | 'psyche'
  | 'instinct'
  | 'constitution'
  | 'motricity'
  | 'perception';

export const ATTRIBUTE_NAMES: readonly AttributeName[] = [
  'cognition',
  'psyche',
  'instinct',
  'constitution',
  'motricity',
  'perception',
];

export interface AttributeScores {
  cognition: number;
  psyche: number;
  instinct: number;
  constitution: number;
  motricity: number;
  perception: number;
}

export interface ProficiencyScores {
  cognitionProficiency: ProficiencyLevel;
  psycheProficiency: ProficiencyLevel;
  instinctProficiency: ProficiencyLevel;
  constitutionProficiency: ProficiencyLevel;
  motricityProficiency: ProficiencyLevel;
  perceptionProficiency: ProficiencyLevel;
}

export interface Character extends AttributeScores, ProficiencyScores {
  id: string;
  playerId: string;
  gameId: string;
  nickname: string;
  epithet: string | null;
  np: number;
  maxHp: number;
  maxEffort: number;
  bExp: number;
  currentHp: number;
  currentEffort: number;
  hairColor: string | null;
  heightCm: number | null;
  weightKg: number | null;
  size: string | null;
  background: string | null;
  profession: string | null;
  motivation: string | null;
  affliction: string | null;
  socialClass: SocialClassKey | null;
  vaalaques: number;
  bonds: string | null;
  personality: string | null;
  posture: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterSheetInput extends AttributeScores {
  nickname: string;
  epithet?: string;
  np: number;
  hairColor?: string;
  heightCm?: number;
  weightKg?: number;
  background?: string;
  profession?: string;
  motivation?: string;
  affliction?: string;
  personality: string;
  posture: string;
  socialClass: SocialClassKey;
  bonds?: string;
}

export interface CreateCharacterInput
  extends CharacterSheetInput, ProficiencyScores {
  playerId: string;
  gameId: string;
  size: string | null;
  vaalaques: number;
  maxHp: number;
  currentHp: number;
  maxEffort: number;
  currentEffort: number;
  bExp: number;
}

export interface UpdateCharacterInput {
  nickname?: string;
  epithet?: string;
  np?: number;
  cognition?: number;
  psyche?: number;
  instinct?: number;
  constitution?: number;
  motricity?: number;
  perception?: number;
  cognitionProficiency?: ProficiencyLevel;
  psycheProficiency?: ProficiencyLevel;
  instinctProficiency?: ProficiencyLevel;
  constitutionProficiency?: ProficiencyLevel;
  motricityProficiency?: ProficiencyLevel;
  perceptionProficiency?: ProficiencyLevel;
  maxHp?: number;
  maxEffort?: number;
  bExp?: number;
  currentHp?: number;
  currentEffort?: number;
  hairColor?: string;
  heightCm?: number;
  weightKg?: number;
  size?: string | null;
  background?: string;
  profession?: string;
  motivation?: string;
  affliction?: string;
  socialClass?: SocialClassKey;
  vaalaques?: number;
  bonds?: string;
  personality?: string;
  posture?: string;
}

export interface UpdateVitalsInput {
  currentHp?: number;
  currentEffort?: number;
}

export type ItemType =
  | 'weapon'
  | 'armor'
  | 'overlay'
  | 'coating'
  | 'accessory'
  | 'consumable'
  | 'misc';

export type ItemSlot =
  | 'head'
  | 'torso'
  | 'arms'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'ring_1'
  | 'ring_2'
  | 'external'
  | 'backpack';

export interface CharacterItem {
  id: string;
  characterId: string;
  name: string;
  type: ItemType;
  slot: ItemSlot;
  equipped: boolean;
  description: string | null;
  quantity: number;
  attributes: Record<string, number> | null;
}

export interface CreateItemInput {
  name: string;
  type: ItemType;
  slot?: ItemSlot;
  equipped?: boolean;
  description?: string;
  quantity?: number;
  attributes?: Record<string, number>;
}

export interface UpdateItemInput {
  name?: string;
  type?: ItemType;
  slot?: ItemSlot;
  equipped?: boolean;
  description?: string;
  quantity?: number;
  attributes?: Record<string, number>;
}

export interface CharacterSkill {
  id: string;
  characterId: string;
  skillId: string;
  proficiencyBonus: number;
}

export interface UpsertSkillInput {
  skillId: string;
  proficiencyBonus: number;
}

/** A row from the seeded skill catalog, used to resolve a skill's attribute. */
export interface SkillSummary {
  id: string;
  name: string;
  attribute: AttributeName;
}

/** A character skill joined with its catalog attribute for budget validation. */
export interface CharacterSkillDetail extends CharacterSkill {
  skillName: string;
  attribute: AttributeName;
}

export interface Page {
  limit: number;
  offset: number;
}

export const DEFAULT_CHARACTER_PAGE: Page = { limit: 20, offset: 0 };

export interface Vitals {
  hp: number;
  effort: number;
}
