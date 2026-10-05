import { describe, it, expect } from 'vitest';
import { rollAttribute, rollDie, rollWithModifiers, type Rng } from './roll.js';

const fixedRng: Rng = (min, max) => max;

describe('rollDie', () => {
  it('delegates the 1..sides bounds to the rng', () => {
    const calls: Array<[number, number]> = [];
    const rng: Rng = (min, max) => {
      calls.push([min, max]);
      return min;
    };

    expect(rollDie(20, rng)).toBe(1);
    expect(calls).toEqual([[1, 20]]);
  });
});

describe('rollAttribute', () => {
  it('returns a single roll for attrValue = 0', () => {
    const result = rollAttribute(0, fixedRng);
    expect(result.rolls).toHaveLength(1);
    expect(result.kind).toBe('single');
  });

  it('returns qty = |attrValue| + 1 rolls', () => {
    expect(rollAttribute(3, fixedRng).rolls).toHaveLength(4);
    expect(rollAttribute(-2, fixedRng).rolls).toHaveLength(3);
  });

  it('picks the best roll for a positive attribute', () => {
    const result = rollAttribute(2, fixedRng);
    expect(result.kind).toBe('best');
    expect(result.result).toBe(Math.max(...result.rolls));
  });

  it('picks the worst roll for a negative attribute', () => {
    const result = rollAttribute(-2, fixedRng);
    expect(result.kind).toBe('worst');
    expect(result.result).toBe(Math.min(...result.rolls));
  });

  it('requests d20 (1..20) for every roll', () => {
    const calls: Array<[number, number]> = [];
    const rng: Rng = (min, max) => {
      calls.push([min, max]);
      return 10;
    };

    const { rolls } = rollAttribute(4, rng);
    expect(rolls).toHaveLength(5);
    for (const [min, max] of calls) {
      expect(min).toBe(1);
      expect(max).toBe(20);
    }
  });
});

describe('rollWithModifiers', () => {
  it('adds every bonus to the attribute result', () => {
    const rng: Rng = () => 5;
    expect(rollWithModifiers({ attrValue: 0, bonuses: [2, 3] }, rng)).toBe(10);
  });

  it('applies the best roll plus bonuses for a positive attribute', () => {
    const rng: Rng = () => 7;
    expect(rollWithModifiers({ attrValue: 2, bonuses: [-1, 4] }, rng)).toBe(10);
  });
});
