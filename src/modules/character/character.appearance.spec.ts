import { describe, expect, it } from 'vitest';
import type { Rng } from '@shared/dice/roll.js';
import { resolveHeight, resolveWeight } from './character.appearance.js';
import { InvalidHeightError, InvalidWeightError } from './character.errors.js';

function fixedRng(value: number): Rng {
  return () => value;
}

describe('resolveHeight', () => {
  it('rejects a value and a roll at once', () => {
    expect(() =>
      resolveHeight({ heightCm: 160, heightRoll: 'min' }, fixedRng(1)),
    ).toThrow(InvalidHeightError);
  });

  it('rolls below 150 with the min band', () => {
    expect(resolveHeight({ heightRoll: 'min' }, fixedRng(10))).toBe(140);
  });

  it('rolls above 250 with the max band', () => {
    expect(resolveHeight({ heightRoll: 'max' }, fixedRng(20))).toBe(270);
  });

  it('returns null without a value or roll', () => {
    expect(resolveHeight({}, fixedRng(1))).toBeNull();
  });

  it('rejects an exact value outside 150..250', () => {
    expect(() => resolveHeight({ heightCm: 140 }, fixedRng(1))).toThrow(
      InvalidHeightError,
    );
    expect(() => resolveHeight({ heightCm: 251 }, fixedRng(1))).toThrow(
      InvalidHeightError,
    );
  });

  it('accepts an exact value within 150..250', () => {
    expect(resolveHeight({ heightCm: 150 }, fixedRng(1))).toBe(150);
    expect(resolveHeight({ heightCm: 250 }, fixedRng(1))).toBe(250);
  });
});

describe('resolveWeight', () => {
  it('rejects a value and a roll at once', () => {
    expect(() =>
      resolveWeight({ weightKg: 60, weightRoll: 'min' }, fixedRng(1)),
    ).toThrow(InvalidWeightError);
  });

  it('rolls below 50 with the min band', () => {
    expect(resolveWeight({ weightRoll: 'min' }, fixedRng(10))).toBe(40);
  });

  it('rolls above 150 with the max band', () => {
    expect(resolveWeight({ weightRoll: 'max' }, fixedRng(20))).toBe(170);
  });

  it('returns null without a value or roll', () => {
    expect(resolveWeight({}, fixedRng(1))).toBeNull();
  });

  it('rejects an exact value outside 50..150', () => {
    expect(() => resolveWeight({ weightKg: 40 }, fixedRng(1))).toThrow(
      InvalidWeightError,
    );
    expect(() => resolveWeight({ weightKg: 151 }, fixedRng(1))).toThrow(
      InvalidWeightError,
    );
  });

  it('accepts an exact value within 50..150', () => {
    expect(resolveWeight({ weightKg: 50 }, fixedRng(1))).toBe(50);
    expect(resolveWeight({ weightKg: 150 }, fixedRng(1))).toBe(150);
  });
});
