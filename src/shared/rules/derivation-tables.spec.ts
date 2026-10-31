import { describe, expect, it } from 'vitest';
import { rollAttribute } from '../dice/roll.js';
import { ATTRIBUTE_SCALE } from './attributes.js';
import { derivationTables } from './derivation-tables.js';
import {
  PROFICIENCY_LEVELS,
  proficiencyPool,
  skillBonusCap,
} from './proficiency.js';
import { rollHeight, rollWeight } from './size.js';
import { bExp, hitDie, maxEffort, maxHp } from './vitals.js';

const NPS = Array.from({ length: 20 }, (_, index) => index + 1);
const SKILL_BONUSES = [0, 1, 7, 14, 20, 30];
const tables = derivationTables();

describe('derivationTables parity with the rule functions', () => {
  it.each(NPS)('maxHp matches at NP %i for every CON and skill bonus', (np) => {
    for (const con of ATTRIBUTE_SCALE) {
      for (const bonus of SKILL_BONUSES) {
        const { base, hitDiePerNp } = tables.vitalFormulas.maxHp;
        const dieTerm = hitDiePerNp
          ? np * tables.hitDieByConstitution[con].max
          : 0;
        const served = base + dieTerm + bonus;
        expect(served).toBe(maxHp(np, con, bonus));
      }
    }
  });

  it('maxEffort matches for every skill bonus', () => {
    for (const bonus of SKILL_BONUSES) {
      expect(tables.vitalFormulas.maxEffort.base + bonus).toBe(
        maxEffort(bonus),
      );
    }
  });

  it('hitDie matches for the full attribute scale', () => {
    for (const con of ATTRIBUTE_SCALE) {
      expect(tables.hitDieByConstitution[con]).toEqual(hitDie(con));
    }
  });

  it.each(NPS)('bExp and proficiency pools match at NP %i', (np) => {
    expect(tables.bExpByNp[np]).toBe(bExp(np));
    for (const { key } of PROFICIENCY_LEVELS) {
      expect(tables.proficiencyPoolByNp[key][np]).toBe(
        proficiencyPool(key, np),
      );
    }
  });

  it('skill cap matches per proficiency level', () => {
    for (const { key } of PROFICIENCY_LEVELS) {
      expect(tables.skillCapByLevel[key]).toBe(skillBonusCap(key));
    }
  });

  it('attribute dice match what rollAttribute rolls', () => {
    for (const value of ATTRIBUTE_SCALE) {
      const roll = rollAttribute(value, () => 7);
      expect(tables.attributeDice[value]).toEqual({
        dice: roll.rolls.length,
        keep: roll.kind,
      });
    }
  });

  it('body dimensions match the extreme rolls', () => {
    const lows = [(_min: number, max: number) => max, (min: number) => min];
    for (const rng of lows) {
      const { height, weight } = tables.bodyDimensions;
      expect(rollHeight('min', rng)).toBeGreaterThanOrEqual(height.below.min);
      expect(rollHeight('min', rng)).toBeLessThanOrEqual(height.below.max);
      expect(rollHeight('max', rng)).toBeGreaterThanOrEqual(height.above.min);
      expect(rollHeight('max', rng)).toBeLessThanOrEqual(height.above.max);
      expect(rollWeight('min', rng)).toBeGreaterThanOrEqual(weight.below.min);
      expect(rollWeight('min', rng)).toBeLessThanOrEqual(weight.below.max);
      expect(rollWeight('max', rng)).toBeGreaterThanOrEqual(weight.above.min);
      expect(rollWeight('max', rng)).toBeLessThanOrEqual(weight.above.max);
    }
  });
});
