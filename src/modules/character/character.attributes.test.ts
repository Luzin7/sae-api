import { describe, expect, it } from 'vitest';
import {
  assertAttributeBudget,
  attributeBudget,
  attributePointsSpent,
} from './character.attributes.js';
import {
  AttributeBudgetExceededError,
  InvalidAttributeError,
} from './character.errors.js';
import type { AttributeScores } from './character.entity.js';

function scores(overrides: Partial<AttributeScores> = {}): AttributeScores {
  return {
    cognition: -5,
    psyche: -5,
    instinct: -5,
    constitution: -5,
    motricity: -5,
    perception: -5,
    ...overrides,
  };
}

describe('attributeBudget', () => {
  it('grants 20 points at NP1 and +2 per even NP', () => {
    expect(attributeBudget(1)).toBe(20);
    expect(attributeBudget(2)).toBe(22);
    expect(attributeBudget(3)).toBe(22);
    expect(attributeBudget(4)).toBe(24);
  });
});

describe('attributePointsSpent', () => {
  it('charges the scale index from the -5 floor', () => {
    expect(attributePointsSpent(scores())).toBe(0);
    expect(attributePointsSpent(scores({ cognition: 5 }))).toBe(8);
    expect(attributePointsSpent(scores({ cognition: 1 }))).toBe(4);
  });

  it('rejects -1 and 0 with a named validation error', () => {
    expect(() => attributePointsSpent(scores({ cognition: 0 }))).toThrow(
      InvalidAttributeError,
    );
    expect(() => attributePointsSpent(scores({ instinct: -1 }))).toThrow(
      InvalidAttributeError,
    );
  });
});

describe('assertAttributeBudget', () => {
  it('accepts a spread within the np budget', () => {
    expect(() =>
      assertAttributeBudget(1, scores({ cognition: 5 })),
    ).not.toThrow();
  });

  it('rejects an out-of-scale value before checking the budget', () => {
    expect(() => assertAttributeBudget(1, scores({ psyche: 0 }))).toThrow(
      InvalidAttributeError,
    );
  });

  it('throws when the spread exceeds the np budget', () => {
    expect(() =>
      assertAttributeBudget(
        1,
        scores({
          cognition: 5,
          psyche: 5,
          instinct: 5,
          motricity: 5,
        }),
      ),
    ).toThrow(AttributeBudgetExceededError);
  });
});
