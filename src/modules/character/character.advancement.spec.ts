import { describe, expect, it } from 'vitest';
import { advancementBalance } from './character.advancement.js';
import { makeCharacter } from './character.testkit.js';

const SPENT_ALL_NP1 = {
  cognition: 5,
  psyche: -5,
  instinct: -5,
  constitution: -5,
  motricity: -5,
  perception: -5,
} as const;

describe('advancementBalance', () => {
  it('leaves no attribute points for an NP1 character that spent all 20', () => {
    const sheet = makeCharacter({
      np: 1,
      cognition: 5,
      psyche: 4,
      instinct: 2,
      constitution: -5,
      motricity: -5,
      perception: -5,
    });

    expect(advancementBalance(sheet, []).attributePoints).toEqual({
      budget: 20,
      spent: 20,
      remaining: 0,
    });
  });

  it('leaves 2 attribute points at NP2 with the NP1 spend', () => {
    const sheet = makeCharacter({
      np: 2,
      cognition: 5,
      psyche: 4,
      instinct: 2,
      constitution: -5,
      motricity: -5,
      perception: -5,
    });

    expect(advancementBalance(sheet, []).attributePoints).toEqual({
      budget: 22,
      spent: 20,
      remaining: 2,
    });
  });

  it('derives the skill pool of a Versado Cognição at NP3 with 10 spent', () => {
    const sheet = makeCharacter({
      np: 3,
      ...SPENT_ALL_NP1,
      cognitionProficiency: 'versado',
    });

    const balance = advancementBalance(sheet, [
      { attribute: 'cognition', spent: 10 },
    ]);

    expect(balance.skillPoints.cognition).toEqual({
      budget: 20,
      spent: 10,
      remaining: 10,
    });
    expect(balance.skillPoints.psyche).toEqual({
      budget: 4,
      spent: 0,
      remaining: 4,
    });
  });
});
