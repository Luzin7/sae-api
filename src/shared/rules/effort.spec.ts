import { describe, expect, it } from 'vitest';
import { InvalidEffortInputError } from '../errors/invalid-effort-input-error.js';
import {
  applyEffortChange,
  EffortDeltaSchema,
  recoverEffortOnTurnAdvance,
} from './effort.js';

const vitals = (
  currentEffort: number,
  effortLimit: number,
  currentHp: number,
) => ({
  currentEffort,
  effortLimit,
  currentHp,
});

describe('applyEffortChange', () => {
  it.each([
    [5, 20, 30, 3, 8, 20, 30, 0],
    [18, 20, 30, 2, 20, 20, 30, 0],
    [18, 20, 30, 5, 20, 20, 27, 3],
    [20, 20, 30, 1, 20, 20, 29, 1],
    [20, 20, 2, 5, 20, 20, 0, 2],
    [20, 20, 30, -4, 16, 20, 30, 0],
    [3, 20, 30, -5, 0, 20, 30, 0],
  ])(
    '%i/%i PS %i delta %i',
    (effort, limit, hp, delta, expEffort, expLimit, expHp, expLost) => {
      expect(applyEffortChange(vitals(effort, limit, hp), delta)).toEqual({
        currentEffort: expEffort,
        effortLimit: expLimit,
        currentHp: expHp,
        bloodLost: expLost,
      });
    },
  );

  it.each([[1.5], [0], [Number.NaN]])('rejects delta %s', (delta) => {
    expect(() => applyEffortChange(vitals(5, 20, 30), delta)).toThrow(
      InvalidEffortInputError,
    );
  });

  it('rejects a negative limit', () => {
    expect(() => applyEffortChange(vitals(5, -1, 30), 1)).toThrow(
      InvalidEffortInputError,
    );
  });
});

describe('recoverEffortOnTurnAdvance', () => {
  const holders = [
    { id: 'A', currentEffort: 3 },
    { id: 'B', currentEffort: 2 },
    { id: 'C', currentEffort: 0 },
  ];

  it('drops 1 PE from everyone but the starting turn, skipping zero', () => {
    expect(recoverEffortOnTurnAdvance(holders, 'B')).toEqual([
      { id: 'A', oldEffort: 3, newEffort: 2 },
    ]);
  });

  it('turn A to B: A and C lose 1 when both hold effort', () => {
    const all = [
      { id: 'A', currentEffort: 3 },
      { id: 'B', currentEffort: 2 },
      { id: 'C', currentEffort: 1 },
    ];

    expect(recoverEffortOnTurnAdvance(all, 'B')).toEqual([
      { id: 'A', oldEffort: 3, newEffort: 2 },
      { id: 'C', oldEffort: 1, newEffort: 0 },
    ]);
  });
});

describe('EffortDeltaSchema', () => {
  it.each([1, -1, 100, -100])('accepts %i', (value) => {
    expect(EffortDeltaSchema.safeParse(value).success).toBe(true);
  });

  it.each([0, 101, -101, 1.5, '3'])('rejects %s', (value) => {
    expect(EffortDeltaSchema.safeParse(value).success).toBe(false);
  });
});
