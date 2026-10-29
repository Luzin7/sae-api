import { deriveProficiency } from '@shared/rules/archetypes.js';
import {
  socialClassEconomy,
  WEALTH_DIE_SIDES,
  type SocialClassKey,
} from '@shared/rules/social-classes.js';
import {
  nextSizeCategory,
  sizeCategory,
  sizeFactorMean,
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

/** Size factor, category and next category; null when height/weight is missing or out of bands. */
export function deriveSizeDetail(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
): SizeDetail | null {
  if (heightCm === null || heightCm === undefined) return null;
  if (weightKg === null || weightKg === undefined) return null;

  const factor = sizeFactorMean(heightCm, weightKg);
  if (factor === null) return null;

  const category = sizeCategory(factor);
  if (category === null) return null;

  return { factor, category, next: nextSizeCategory(factor) };
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
