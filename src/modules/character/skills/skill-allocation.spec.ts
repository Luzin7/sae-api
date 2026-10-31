import { describe, expect, it } from 'vitest';
import {
  SkillBonusCapExceededError,
  SkillPoolExceededError,
} from '../character.errors.js';
import { makeCharacter, makeSkillDetail } from '../character.testkit.js';
import { assertSkillBonusCaps, assertSkillPools } from './skill-allocation.js';

describe('assertSkillPools', () => {
  it('throws when an attribute spends more than its pool', () => {
    expect(() =>
      assertSkillPools(makeCharacter(), 1, [
        makeSkillDetail({ proficiencyBonus: 3 }),
      ]),
    ).toThrow(SkillPoolExceededError);
  });

  it('accepts spending within the pool', () => {
    expect(() =>
      assertSkillPools(makeCharacter(), 1, [
        makeSkillDetail({ proficiencyBonus: 2 }),
      ]),
    ).not.toThrow();
  });
});

describe('assertSkillBonusCaps', () => {
  it('throws above +20 for a non-Especialista attribute', () => {
    expect(() =>
      assertSkillBonusCaps(makeCharacter(), [
        makeSkillDetail({ proficiencyBonus: 21 }),
      ]),
    ).toThrow(SkillBonusCapExceededError);
  });

  it('allows +30 for an Especialista attribute', () => {
    expect(() =>
      assertSkillBonusCaps(
        makeCharacter({ constitutionProficiency: 'especialista' }),
        [makeSkillDetail({ proficiencyBonus: 30 })],
      ),
    ).not.toThrow();
  });
});
