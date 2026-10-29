import { z } from 'zod';
import { InvalidEffortInputError } from '../errors/invalid-effort-input-error.js';

export const MAX_EFFORT_DELTA = 100;

export const EffortDeltaSchema = z
  .number()
  .int()
  .min(-MAX_EFFORT_DELTA)
  .max(MAX_EFFORT_DELTA)
  .refine((value) => value !== 0);

export interface EffortVitals {
  currentEffort: number;
  effortLimit: number;
  currentHp: number;
}

export interface EffortChange extends EffortVitals {
  bloodLost: number;
}

export function applyEffortChange(
  vitals: EffortVitals,
  delta: number,
): EffortChange {
  assertValidLimit(vitals.effortLimit);
  assertValidDelta(delta);

  const requested = Math.max(vitals.currentEffort + delta, 0);
  const currentEffort = Math.min(requested, vitals.effortLimit);
  const excess = requested - currentEffort;
  const bloodLost = Math.min(excess, vitals.currentHp);

  return {
    currentEffort,
    effortLimit: vitals.effortLimit,
    currentHp: vitals.currentHp - bloodLost,
    bloodLost,
  };
}

function assertValidLimit(effortLimit: number): void {
  if (Number.isFinite(effortLimit) && effortLimit >= 0) return;
  throw new InvalidEffortInputError(
    'O Limite de Esforço não pode ser negativo.',
  );
}

function assertValidDelta(delta: number): void {
  if (Number.isInteger(delta) && delta !== 0) return;
  throw new InvalidEffortInputError(
    'A variação de esforço deve ser um número inteiro diferente de zero.',
  );
}

export interface EffortHolder {
  id: string;
  currentEffort: number;
}

export interface EffortRecovery {
  id: string;
  oldEffort: number;
  newEffort: number;
}

export function recoverEffortOnTurnAdvance(
  holders: readonly EffortHolder[],
  startingId: string,
): EffortRecovery[] {
  return holders
    .filter((holder) => holder.id !== startingId && holder.currentEffort > 0)
    .map((holder) => ({
      id: holder.id,
      oldEffort: holder.currentEffort,
      newEffort: holder.currentEffort - 1,
    }));
}
