import { describe, it, expect } from 'vitest';
import { bExp, hitDie, maxEffort, maxHp } from './character.stats.js';

describe('hitDie', () => {
  it('returns d6 for constitution -5..-4', () => {
    expect(hitDie(-5).die).toBe('d6');
    expect(hitDie(-4).die).toBe('d6');
  });

  it('returns d8 for constitution -3..-2', () => {
    expect(hitDie(-3).die).toBe('d8');
    expect(hitDie(-2).die).toBe('d8');
  });

  it('returns d10 for constitution 1..2', () => {
    expect(hitDie(1).die).toBe('d10');
    expect(hitDie(2).die).toBe('d10');
  });

  it('returns d12 for constitution 3..4', () => {
    expect(hitDie(3).die).toBe('d12');
    expect(hitDie(4).die).toBe('d12');
  });

  it('returns d20 for constitution 5', () => {
    expect(hitDie(5).die).toBe('d20');
  });
});

describe('maxHp', () => {
  it('calculates as 20 + np * dieMax + prof(Vitalidade)', () => {
    expect(maxHp(5, 2, 6)).toBe(20 + 5 * 10 + 6);
    expect(maxHp(1, 5, 14)).toBe(20 + 1 * 20 + 14);
  });

  it('uses d6 max (6) for constitution -5', () => {
    expect(maxHp(1, -5, 0)).toBe(20 + 1 * 6);
  });
});

describe('maxEffort', () => {
  it('calculates as 20 + prof(Condicionamento)', () => {
    expect(maxEffort(0)).toBe(20);
    expect(maxEffort(10)).toBe(30);
  });
});

describe('bExp', () => {
  it('derives the budget experience from np with floor(np / 2)', () => {
    expect(bExp(1)).toBe(0);
    expect(bExp(2)).toBe(1);
    expect(bExp(3)).toBe(1);
    expect(bExp(10)).toBe(5);
    expect(bExp(20)).toBe(10);
  });

  it('returns 0 for np below 1', () => {
    expect(bExp(0)).toBe(0);
    expect(bExp(-1)).toBe(0);
  });
});
