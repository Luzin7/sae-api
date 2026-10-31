import { deriveProficiency } from '@shared/rules/archetypes.js';
import {
  socialClassEconomy,
  WEALTH_DIE_SIDES,
  type SocialClassKey,
} from '@shared/rules/social-classes.js';
import {
  nextSizeCategory,
  heightFactor,
  rolledHeightFactor,
  rolledWeightFactor,
  sizeCategory,
  weightFactor,
  type SizeExtremeBand,
  type NextSizeCategory,
  type SizeCategoryKey,
} from '@shared/rules/size.js';
import type { ProficiencyScores } from './character.entity.js';
import { InvalidArchetypeError } from './character.errors.js';
import type { SkillAllocationDetail } from './skills/skill-allocation.js';

export type Rng = (min: number, max: number) => number;

/** Derives the six per-attribute proficiency levels from personality + posture. */
export function deriveProficiencies(
  personality: string,
  posture: string,
): ProficiencyScores {
  const levels = deriveProficiency(personality, posture);
  if (!levels) throw new InvalidArchetypeError(personality, posture);

  return {
    cognitionProficiency: levels.cognition,
    psycheProficiency: levels.psyche,
    instinctProficiency: levels.instinct,
    constitutionProficiency: levels.constitution,
    motricityProficiency: levels.motricity,
    perceptionProficiency: levels.perception,
  };
}

export interface SizeDetail {
  factor: number;
  category: SizeCategoryKey;
  next: NextSizeCategory | null;
}

function sizeDetailFromFactors(
  height: number | null,
  weight: number | null,
): SizeDetail | null {
  if (height === null || weight === null) return null;

  const factor = (height + weight) / 2;
  const category = sizeCategory(factor);
  if (category === null) return null;

  return { factor, category, next: nextSizeCategory(factor) };
}

/** Size factor, category and next category; null when height/weight is missing or out of bands. */
export function deriveSizeDetail(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
): SizeDetail | null {
  if (heightCm === null || heightCm === undefined) return null;
  if (weightKg === null || weightKg === undefined) return null;

  return sizeDetailFromFactors(heightFactor(heightCm), weightFactor(weightKg));
}

export interface SizeInputs {
  heightCm?: number | null;
  heightRoll?: SizeExtremeBand;
  weightKg?: number | null;
  weightRoll?: SizeExtremeBand;
}

export type SizeDimension = 'height' | 'weight';

const SIZE_DIMENSIONS = {
  height: {
    rolledFactor: rolledHeightFactor,
    factorOf: heightFactor,
    valueKey: 'heightCm',
    rollKey: 'heightRoll',
  },
  weight: {
    rolledFactor: rolledWeightFactor,
    factorOf: weightFactor,
    valueKey: 'weightKg',
    rollKey: 'weightRoll',
  },
} as const;

/** Size factor of one dimension: a rolled band counts as its fixed factor; null when missing or out of bands. */
export function sizeFactor(
  dimension: SizeDimension,
  input: SizeInputs,
): number | null {
  const { rolledFactor, factorOf, valueKey, rollKey } =
    SIZE_DIMENSIONS[dimension];
  const roll = input[rollKey];
  if (roll) return rolledFactor(roll);
  const value = input[valueKey];
  if (value === null || value === undefined) return null;

  return factorOf(value);
}

/** Like `deriveSizeDetail`, but a rolled dimension counts as its band's fixed factor. */
export function derivePreviewSizeDetail(input: SizeInputs): SizeDetail | null {
  return sizeDetailFromFactors(
    sizeFactor('height', input),
    sizeFactor('weight', input),
  );
}

/** Size category key from height/weight; null when either is missing. */
export function deriveSize(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
): string | null {
  return deriveSizeDetail(heightCm, weightKg)?.category ?? null;
}

/** Initial economy: (2d4) × social-class multiplier. */
export function deriveVaalaques(socialClass: SocialClassKey, rng: Rng): number {
  return socialClassEconomy(
    socialClass,
    rng(1, WEALTH_DIE_SIDES) + rng(1, WEALTH_DIE_SIDES),
  );
}

export function proficiencyBonus(
  skills: readonly SkillAllocationDetail[],
  skillName: string,
): number {
  const skill = skills.find((entry) => entry.skillName === skillName);

  return skill ? skill.proficiencyBonus : 0;
}
