import { describe, expect, it } from 'vitest';
import { InvalidHpInputError } from '../errors/invalid-hp-input-error.js';
import { applyHpChange, HpDeltaSchema, MAX_HP_DELTA } from './hp.js';

describe('applyHpChange', () => {
  it.each([
    [10, 30, 5, 15],
    [28, 30, 5, 30],
    [3, 30, -5, 0],
    [0, 30, -1, 0],
    [30, 30, 1, 30],
    [30, 30, -30, 0],
  ])('%i/%i delta %i gives %i', (currentHp, maxHp, delta, expected) => {
    expect(applyHpChange({ currentHp, maxHp }, delta)).toEqual({
      currentHp: expected,
    });
  });

  it.each([0, 1.5, Number.NaN])('rejects delta %s', (delta) => {
    expect(() => applyHpChange({ currentHp: 10, maxHp: 30 }, delta)).toThrow(
      InvalidHpInputError,
    );
  });

  it('rejects a negative max', () => {
    expect(() => applyHpChange({ currentHp: 0, maxHp: -1 }, 1)).toThrow(
      InvalidHpInputError,
    );
  });
});

describe('HpDeltaSchema', () => {
  it.each([1, -1, MAX_HP_DELTA, -MAX_HP_DELTA])('accepts %i', (value) => {
    expect(HpDeltaSchema.safeParse(value).success).toBe(true);
  });

  it.each([0, MAX_HP_DELTA + 1, -MAX_HP_DELTA - 1, 2.5, '3'])(
    'rejects %s',
    (value) => {
      expect(HpDeltaSchema.safeParse(value).success).toBe(false);
    },
  );
});
