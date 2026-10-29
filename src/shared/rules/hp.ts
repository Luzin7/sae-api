import { z } from 'zod';
import { InvalidHpInputError } from '../errors/invalid-hp-input-error.js';

export const MAX_HP_DELTA = 1000;

export const HpDeltaSchema = z
  .number()
  .int()
  .min(-MAX_HP_DELTA)
  .max(MAX_HP_DELTA)
  .refine((value) => value !== 0);

export interface HpVitals {
  currentHp: number;
  maxHp: number;
}

/** PS after a delta: clamp(current + delta, 0, maxHp). */
export function applyHpChange(
  vitals: HpVitals,
  delta: number,
): { currentHp: number } {
  if (!Number.isFinite(vitals.maxHp) || vitals.maxHp < 0) {
    throw new InvalidHpInputError('O máximo de PS não pode ser negativo.');
  }
  if (!Number.isInteger(delta) || delta === 0) {
    throw new InvalidHpInputError(
      'A variação de PS deve ser um número inteiro diferente de zero.',
    );
  }

  return {
    currentHp: Math.min(Math.max(vitals.currentHp + delta, 0), vitals.maxHp),
  };
}
