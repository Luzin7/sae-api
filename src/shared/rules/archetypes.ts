import type { AttributeKey } from './attributes.js';
import type { ProficiencyLevel } from './proficiency.js';

export interface MentalLevels {
  cognition: ProficiencyLevel;
  psyche: ProficiencyLevel;
  instinct: ProficiencyLevel;
}

export interface CorporalLevels {
  constitution: ProficiencyLevel;
  motricity: ProficiencyLevel;
  perception: ProficiencyLevel;
}

export interface PersonalityDefinition {
  name: string;
  levels: MentalLevels;
}

export interface PostureDefinition {
  name: string;
  levels: CorporalLevels;
}

/** 10 personalities → mental attribute levels (COG / PSI / INT). */
export const PERSONALITIES: readonly PersonalityDefinition[] = [
  { name: 'Erudito', levels: { cognition: 'especialista', psyche: 'imperito', instinct: 'imperito' } },
  { name: 'Urbano', levels: { cognition: 'imperito', psyche: 'especialista', instinct: 'imperito' } },
  { name: 'Místico', levels: { cognition: 'imperito', psyche: 'imperito', instinct: 'especialista' } },
  { name: 'Cético', levels: { cognition: 'versado', psyche: 'competente', instinct: 'imperito' } },
  { name: 'Líder', levels: { cognition: 'competente', psyche: 'versado', instinct: 'imperito' } },
  { name: 'Lúdico', levels: { cognition: 'versado', psyche: 'imperito', instinct: 'competente' } },
  { name: 'Visionário', levels: { cognition: 'competente', psyche: 'imperito', instinct: 'versado' } },
  { name: 'Virtuoso', levels: { cognition: 'imperito', psyche: 'competente', instinct: 'versado' } },
  { name: 'Idealista', levels: { cognition: 'imperito', psyche: 'versado', instinct: 'competente' } },
  { name: 'Polímata', levels: { cognition: 'competente', psyche: 'competente', instinct: 'competente' } },
];

/** 10 postures → corporal attribute levels (CON / MOT / PER). */
export const POSTURES: readonly PostureDefinition[] = [
  { name: 'Abrutalhado', levels: { constitution: 'especialista', motricity: 'imperito', perception: 'imperito' } },
  { name: 'Dinâmico', levels: { constitution: 'imperito', motricity: 'especialista', perception: 'imperito' } },
  { name: 'Aguçado', levels: { constitution: 'imperito', motricity: 'imperito', perception: 'especialista' } },
  { name: 'Arrojado', levels: { constitution: 'versado', motricity: 'competente', perception: 'imperito' } },
  { name: 'Competitivo', levels: { constitution: 'competente', motricity: 'versado', perception: 'imperito' } },
  { name: 'Protetor', levels: { constitution: 'versado', motricity: 'imperito', perception: 'competente' } },
  { name: 'Vigilante', levels: { constitution: 'competente', motricity: 'imperito', perception: 'versado' } },
  { name: 'Reativo', levels: { constitution: 'imperito', motricity: 'versado', perception: 'competente' } },
  { name: 'Predador', levels: { constitution: 'imperito', motricity: 'competente', perception: 'versado' } },
  { name: 'Versátil', levels: { constitution: 'competente', motricity: 'competente', perception: 'competente' } },
];

export type ArchetypeProficiency = Record<AttributeKey, ProficiencyLevel>;

export function deriveProficiency(
  personalityName: string,
  postureName: string,
): ArchetypeProficiency | null {
  const personality = PERSONALITIES.find((entry) => entry.name === personalityName);
  if (!personality) return null;

  const posture = POSTURES.find((entry) => entry.name === postureName);
  if (!posture) return null;

  return { ...personality.levels, ...posture.levels };
}
