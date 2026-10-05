export interface SizeFactorBand {
  min: number;
  max: number | null;
  factor: number;
}

/** Height factor: open ends are `150 − 1d10` (below 150) and `250 + 1d20` (above 250). */
export const HEIGHT_FACTORS: readonly SizeFactorBand[] = [
  { min: 0, max: 149, factor: 0 },
  { min: 150, max: 170, factor: 1 },
  { min: 171, max: 190, factor: 2 },
  { min: 191, max: 210, factor: 3 },
  { min: 211, max: 250, factor: 4 },
  { min: 251, max: null, factor: 5 },
];

/** Weight factor: open ends are `50 − 1d10` (below 50) and `150 + 1d20` (above 150). */
export const WEIGHT_FACTORS: readonly SizeFactorBand[] = [
  { min: 0, max: 49, factor: 0 },
  { min: 50, max: 70, factor: 1 },
  { min: 71, max: 90, factor: 2 },
  { min: 91, max: 120, factor: 3 },
  { min: 121, max: 150, factor: 4 },
  { min: 151, max: null, factor: 5 },
];

export type SizeCategoryKey =
  | 'miudo'
  | 'pequeno'
  | 'medio'
  | 'grande'
  | 'enorme';

export interface SizeCategoryDefinition {
  key: SizeCategoryKey;
  name: string;
  min: number;
  max: number;
}

export const SIZE_CATEGORIES: readonly SizeCategoryDefinition[] = [
  { key: 'miudo', name: 'Miúdo', min: 0, max: 0 },
  { key: 'pequeno', name: 'Pequeno', min: 0.5, max: 1.5 },
  { key: 'medio', name: 'Médio', min: 2, max: 3 },
  { key: 'grande', name: 'Grande', min: 3.5, max: 4.5 },
  { key: 'enorme', name: 'Enorme', min: 5, max: 5 },
];

function findFactor(
  bands: readonly SizeFactorBand[],
  value: number,
): number | null {
  const band = bands.find(
    (entry) => value >= entry.min && (entry.max === null || value <= entry.max),
  );
  if (!band) return null;
  return band.factor;
}

export function heightFactor(cm: number): number | null {
  return findFactor(HEIGHT_FACTORS, cm);
}

export function weightFactor(kg: number): number | null {
  return findFactor(WEIGHT_FACTORS, kg);
}

/** Size = arithmetic mean of the height and weight factors. */
export function sizeFactorMean(heightCm: number, weightKg: number): number | null {
  const height = heightFactor(heightCm);
  const weight = weightFactor(weightKg);
  if (height === null || weight === null) return null;
  return (height + weight) / 2;
}

export function sizeCategory(mean: number): SizeCategoryKey | null {
  const category = SIZE_CATEGORIES.find(
    (entry) => mean >= entry.min && mean <= entry.max,
  );
  if (!category) return null;
  return category.key;
}
