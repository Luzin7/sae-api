export type AttributeKey =
  | 'cognition'
  | 'psyche'
  | 'instinct'
  | 'constitution'
  | 'motricity'
  | 'perception';

export interface AttributeDefinition {
  key: AttributeKey;
  name: string;
  abbr: string;
}

export const ATTRIBUTES: readonly AttributeDefinition[] = [
  { key: 'cognition', name: 'Cognição', abbr: 'COG' },
  { key: 'psyche', name: 'Psicologia', abbr: 'PSI' },
  { key: 'instinct', name: 'Intuição', abbr: 'INT' },
  { key: 'constitution', name: 'Constituição', abbr: 'CON' },
  { key: 'motricity', name: 'Motricidade', abbr: 'MOT' },
  { key: 'perception', name: 'Percepção', abbr: 'PER' },
];

/** Valid attribute values. The scale excludes −1 and 0. */
export type AttributeValue = -5 | -4 | -3 | -2 | 1 | 2 | 3 | 4 | 5;

export const ATTRIBUTE_SCALE: readonly AttributeValue[] = [
  -5, -4, -3, -2, 1, 2, 3, 4, 5,
];

/** Cost to raise an attribute from the −5 floor = its index in the scale. */
export const ATTRIBUTE_COST: Readonly<Record<AttributeValue, number>> = {
  [-5]: 0,
  [-4]: 1,
  [-3]: 2,
  [-2]: 3,
  [1]: 4,
  [2]: 5,
  [3]: 6,
  [4]: 7,
  [5]: 8,
};

export function attributeCost(value: AttributeValue): number {
  return ATTRIBUTE_COST[value];
}

/** NP1 = 20 attribute points; +2 per even NP. */
export function attributeBudget(np: number): number {
  return 20 + 2 * Math.floor(np / 2);
}

export function attributeCostSum(values: readonly AttributeValue[]): number {
  return values.reduce((total, value) => total + attributeCost(value), 0);
}
