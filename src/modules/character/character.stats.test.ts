import { describe, it, expect } from 'vitest';
import {
  calcHitDie,
  calcMaxHp,
  calcMaxEffort,
  calcBExp,
  rollAttribute,
} from './character.stats.js';

describe('calcHitDie', () => {
  it('returns d6 for constitution <= -4', () => {
    expect(calcHitDie(-5).die).toBe('d6');
    expect(calcHitDie(-4).die).toBe('d6');
  });

  it('returns d8 for constitution -3 to 0', () => {
    expect(calcHitDie(-3).die).toBe('d8');
    expect(calcHitDie(-2).die).toBe('d8');
    expect(calcHitDie(0).die).toBe('d8');
  });

  it('returns d10 for constitution 1 to 2', () => {
    expect(calcHitDie(1).die).toBe('d10');
    expect(calcHitDie(2).die).toBe('d10');
  });

  it('returns d12 for constitution 3 to 4', () => {
    expect(calcHitDie(3).die).toBe('d12');
    expect(calcHitDie(4).die).toBe('d12');
  });

  it('returns d20 for constitution >= 5', () => {
    expect(calcHitDie(5).die).toBe('d20');
  });
});

describe('calcMaxHp', () => {
  it('calculates as 20 + level * dieMax + profVitality', () => {
    expect(calcMaxHp(5, 2, 6)).toBe(20 + 5 * 10 + 6);
  });

  it('uses d8 max (8) for constitution 0', () => {
    expect(calcMaxHp(1, 0, 0)).toBe(20 + 1 * 8 + 0);
  });
});

describe('calcMaxEffort', () => {
  it('calculates as constitution * 5 + profWillpower', () => {
    expect(calcMaxEffort(3, 10)).toBe(25);
    expect(calcMaxEffort(-2, 5)).toBe(-5);
  });
});

describe('calcBExp', () => {
  it('returns 0 for level 1, 1 for level 2', () => {
    expect(calcBExp(1)).toBe(0);
    expect(calcBExp(2)).toBe(1);
  });

  it('returns 5 for level 10', () => {
    expect(calcBExp(10)).toBe(5);
  });

  it('returns 10 for level 20', () => {
    expect(calcBExp(20)).toBe(10);
  });

  it('returns 0 for out-of-range level', () => {
    expect(calcBExp(21)).toBe(0);
    expect(calcBExp(0)).toBe(0);
  });
});

describe('rollAttribute', () => {
  it('returns single roll for attrValue = 0', () => {
    const result = rollAttribute(0);
    expect(result.rolls).toHaveLength(1);
    expect(result.kind).toBe('single');
  });

  it('returns qty = |attrValue| + 1 rolls', () => {
    const result = rollAttribute(3);
    expect(result.rolls).toHaveLength(4);
  });

  it('picks the best roll for positive attribute', () => {
    const result = rollAttribute(2);
    expect(result.kind).toBe('best');
    expect(result.result).toBe(Math.max(...result.rolls));
  });

  it('picks the worst roll for negative attribute', () => {
    const result = rollAttribute(-2);
    expect(result.kind).toBe('worst');
    expect(result.result).toBe(Math.min(...result.rolls));
  });

  it('rolls are between 1 and 20', () => {
    for (let i = 0; i < 10; i++) {
      const { rolls } = rollAttribute(4);
      rolls.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(20);
      });
    }
  });
});
