import type { Rng } from '@shared/dice/roll.js';
import {
  HEIGHT_EXACT_MAX,
  HEIGHT_EXACT_MIN,
  rollHeight,
  rollWeight,
  WEIGHT_EXACT_MAX,
  WEIGHT_EXACT_MIN,
  type SizeExtremeBand,
} from '@shared/rules/size.js';
import { InvalidHeightError, InvalidWeightError } from './character.errors.js';

export function resolveHeight(
  input: { heightCm?: number; heightRoll?: SizeExtremeBand },
  rng: Rng,
): number | null {
  if (input.heightRoll !== undefined && input.heightCm !== undefined) {
    throw new InvalidHeightError();
  }
  if (input.heightRoll !== undefined) return rollHeight(input.heightRoll, rng);
  if (input.heightCm === undefined) return null;
  if (input.heightCm < HEIGHT_EXACT_MIN || input.heightCm > HEIGHT_EXACT_MAX) {
    throw new InvalidHeightError();
  }

  return input.heightCm;
}

export function resolveWeight(
  input: { weightKg?: number; weightRoll?: SizeExtremeBand },
  rng: Rng,
): number | null {
  if (input.weightRoll !== undefined && input.weightKg !== undefined) {
    throw new InvalidWeightError();
  }
  if (input.weightRoll !== undefined) return rollWeight(input.weightRoll, rng);
  if (input.weightKg === undefined) return null;
  if (input.weightKg < WEIGHT_EXACT_MIN || input.weightKg > WEIGHT_EXACT_MAX) {
    throw new InvalidWeightError();
  }

  return input.weightKg;
}
