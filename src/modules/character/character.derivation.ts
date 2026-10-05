import { deriveProficiency } from '@shared/rules/archetypes.js';
import {
  socialClassEconomy,
  type SocialClassKey,
} from '@shared/rules/social-classes.js';
import { sizeCategory, sizeFactorMean } from '@shared/rules/size.js';
import type {
  CharacterSkillDetail,
  ProficiencyScores,
} from './character.entity.js';
import { InvalidArchetypeError } from './character.errors.js';

export type Rng = (min: number, max: number) => number;

export const VITALIDADE = 'Vitalidade';
export const CONDICIONAMENTO = 'Condicionamento';

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

/** Size category key from height/weight; null when either is missing. */
export function deriveSize(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
): string | null {
  if (heightCm === null || heightCm === undefined) return null;
  if (weightKg === null || weightKg === undefined) return null;

  const mean = sizeFactorMean(heightCm, weightKg);
  if (mean === null) return null;

  return sizeCategory(mean);
}

/** Initial economy: (2d4) × social-class multiplier. */
export function deriveVaalaques(socialClass: SocialClassKey, rng: Rng): number {
  return socialClassEconomy(socialClass, rng(1, 4) + rng(1, 4));
}

export function proficiencyBonus(
  skills: readonly CharacterSkillDetail[],
  skillName: string,
): number {
  const skill = skills.find((entry) => entry.skillName === skillName);

  return skill ? skill.proficiencyBonus : 0;
}
