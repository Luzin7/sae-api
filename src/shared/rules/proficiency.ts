export type ProficiencyLevel =
  'imperito' | 'competente' | 'versado' | 'especialista';

export interface ProficiencyLevelDefinition {
  key: ProficiencyLevel;
  name: string;
  poolPerNp: number;
}

export const PROFICIENCY_LEVELS: readonly ProficiencyLevelDefinition[] = [
  { key: 'imperito', name: 'Imperito', poolPerNp: 2 },
  { key: 'competente', name: 'Competente', poolPerNp: 6 },
  { key: 'versado', name: 'Versado', poolPerNp: 10 },
  { key: 'especialista', name: 'Especialista', poolPerNp: 14 },
];

/** Proficiency is per skill: 0..+20, raised to +30 for an Especialista attribute. */
export const PROFICIENCY_SKILL_CAP = 20;
export const ESPECIALISTA_SKILL_CAP = 30;

export function skillBonusCap(level: ProficiencyLevel): number {
  if (level === 'especialista') return ESPECIALISTA_SKILL_CAP;
  return PROFICIENCY_SKILL_CAP;
}

/** Proficiency points granted per earned tier (= pool per NP). */
export function levelPoints(level: ProficiencyLevel): number {
  const definition = PROFICIENCY_LEVELS.find((entry) => entry.key === level);
  if (!definition) return 0;
  return definition.poolPerNp;
}

/**
 * Points available per attribute = level pool × number of earned tiers.
 * A tier is granted at NP1 and every odd NP, i.e. `ceil(np / 2)` tiers.
 */
export function proficiencyPool(level: ProficiencyLevel, np: number): number {
  if (np < 1) return 0;
  return levelPoints(level) * Math.ceil(np / 2);
}
