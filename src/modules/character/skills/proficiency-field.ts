import type {
  AttributeName,
  ProficiencyLevel,
  ProficiencyScores,
} from '../character.entity.js';

export const PROFICIENCY_FIELD: Readonly<
  Record<AttributeName, keyof ProficiencyScores>
> = {
  cognition: 'cognitionProficiency',
  psyche: 'psycheProficiency',
  instinct: 'instinctProficiency',
  constitution: 'constitutionProficiency',
  motricity: 'motricityProficiency',
  perception: 'perceptionProficiency',
};

export function proficiencyLevelFor(
  scores: ProficiencyScores,
  attribute: AttributeName,
): ProficiencyLevel {
  return scores[PROFICIENCY_FIELD[attribute]];
}
