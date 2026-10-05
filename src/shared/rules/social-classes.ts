export type SocialClassKey =
  | 'opulento'
  | 'abastado'
  | 'plebeu'
  | 'miseravel';

export interface SocialClassDefinition {
  key: SocialClassKey;
  name: string;
  tier: number;
  multiplier: number;
}

export const SOCIAL_CLASSES: readonly SocialClassDefinition[] = [
  { key: 'opulento', name: 'Opulento', tier: 1, multiplier: 720 },
  { key: 'abastado', name: 'Abastado', tier: 2, multiplier: 120 },
  { key: 'plebeu', name: 'Plebeu', tier: 3, multiplier: 40 },
  { key: 'miseravel', name: 'Miserável', tier: 4, multiplier: 20 },
];

export type SocialDistanceRelation =
  | 'same'
  | 'superior-to-inferior'
  | 'inferior-to-superior';

export interface SocialDistanceModifier {
  relation: SocialDistanceRelation;
  affectedSkills: readonly string[];
}

export const SOCIAL_DISTANCE_MODIFIERS: readonly SocialDistanceModifier[] = [
  {
    relation: 'same',
    affectedSkills: ['Retórica', 'Empatia'],
  },
  {
    relation: 'superior-to-inferior',
    affectedSkills: ['Presença', 'Carisma'],
  },
  {
    relation: 'inferior-to-superior',
    affectedSkills: ['Expressividade', 'Presença', 'Carisma', 'Atuação'],
  },
];

/** CD modifier: same class = −1; superior→inferior = −distance; inferior→superior = +distance. */
export function socialDistanceCdModifier(
  relation: SocialDistanceRelation,
  distance: number,
): number {
  if (relation === 'same') return -1;
  if (relation === 'superior-to-inferior') return -distance;
  return distance;
}

/** Initial economy: (2d4) × class multiplier. */
export function socialClassEconomy(
  socialClass: SocialClassKey,
  roll: number,
): number {
  const definition = SOCIAL_CLASSES.find((entry) => entry.key === socialClass);
  if (!definition) return 0;
  return roll * definition.multiplier;
}
