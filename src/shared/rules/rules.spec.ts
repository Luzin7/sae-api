import { describe, expect, it } from 'vitest';
import {
  ATTRIBUTE_SCALE,
  attributeBudget,
  attributeCost,
  attributeCostSum,
} from './attributes.js';
import { AFFLICTION_KEYS, AFFLICTIONS } from './afflictions.js';
import { OFICIOS, oficioCdReduction } from './oficios.js';
import { SKILLS } from './skills.js';
import { deriveProficiency } from './archetypes.js';
import { levelPoints, proficiencyPool } from './proficiency.js';
import {
  rollHeight,
  rollWeight,
  sizeCategory,
  sizeFactorMean,
  heightFactor,
  weightFactor,
} from './size.js';

describe('attribute cost and budget', () => {
  it('charges the scale index from the −5 floor', () => {
    expect(attributeCost(-5)).toBe(0);
    expect(attributeCost(-2)).toBe(3);
    expect(attributeCost(1)).toBe(4);
    expect(attributeCost(5)).toBe(8);
  });

  it('excludes −1 and 0 from the scale', () => {
    expect(ATTRIBUTE_SCALE).toEqual([-5, -4, -3, -2, 1, 2, 3, 4, 5]);
  });

  it('budgets 20 at NP1 and +2 per even NP', () => {
    expect(attributeBudget(1)).toBe(20);
    expect(attributeBudget(2)).toBe(22);
    expect(attributeBudget(3)).toBe(22);
    expect(attributeBudget(20)).toBe(40);
  });

  it('sums the cost of a stat spread', () => {
    expect(attributeCostSum([-5, -5, -5, -5, -5, -5])).toBe(0);
    expect(attributeCostSum([5, 5, 5, 5, -5, -5])).toBe(32);
  });
});

describe('proficiency pools and archetype derivation', () => {
  it('grants a pool tier at NP1 and every odd NP', () => {
    expect(levelPoints('imperito')).toBe(2);
    expect(levelPoints('especialista')).toBe(14);
    expect(proficiencyPool('imperito', 1)).toBe(2);
    expect(proficiencyPool('imperito', 2)).toBe(2);
    expect(proficiencyPool('imperito', 3)).toBe(4);
    expect(proficiencyPool('especialista', 5)).toBe(14 * 3);
  });

  it('derives the six levels from a personality + posture', () => {
    const levels = deriveProficiency('Erudito', 'Abrutalhado');
    expect(levels).toEqual({
      cognition: 'especialista',
      psyche: 'imperito',
      instinct: 'imperito',
      constitution: 'especialista',
      motricity: 'imperito',
      perception: 'imperito',
    });
  });

  it('returns null for an unknown archetype', () => {
    expect(deriveProficiency('Erudito', 'Inexistente')).toBeNull();
  });
});

describe('ofício CD reduction by NP', () => {
  it('maps each NP band to its degree reduction', () => {
    expect(oficioCdReduction(1)).toBe(1);
    expect(oficioCdReduction(5)).toBe(1);
    expect(oficioCdReduction(6)).toBe(2);
    expect(oficioCdReduction(15)).toBe(3);
    expect(oficioCdReduction(16)).toBe(4);
    expect(oficioCdReduction(20)).toBe(4);
  });

  it('returns 0 outside the NP range', () => {
    expect(oficioCdReduction(0)).toBe(0);
    expect(oficioCdReduction(21)).toBe(0);
  });
});

describe('size mean to category', () => {
  it('derives the factor mean from height and weight', () => {
    expect(sizeFactorMean(160, 60)).toBe(1);
    expect(sizeFactorMean(200, 100)).toBe(3);
    expect(sizeFactorMean(260, 160)).toBe(5);
  });

  it('maps the mean to the size category', () => {
    expect(sizeCategory(0)).toBe('miudo');
    expect(sizeCategory(1)).toBe('pequeno');
    expect(sizeCategory(2.5)).toBe('medio');
    expect(sizeCategory(4)).toBe('grande');
    expect(sizeCategory(5)).toBe('enorme');
  });

  it('returns null for a mean outside 0..5', () => {
    expect(sizeCategory(6)).toBeNull();
  });
});

describe('size extreme rolls', () => {
  const lowest = () => 1;
  const highest = (_min: number, max: number) => max;

  it('rolls height below 150 with 150 − 1d10', () => {
    expect(rollHeight('min', highest)).toBe(140);
    expect(rollHeight('min', lowest)).toBe(149);
  });

  it('rolls height above 250 with 250 + 1d20', () => {
    expect(rollHeight('max', lowest)).toBe(251);
    expect(rollHeight('max', highest)).toBe(270);
  });

  it('rolls weight below 50 with 50 − 1d10', () => {
    expect(rollWeight('min', highest)).toBe(40);
    expect(rollWeight('min', lowest)).toBe(49);
  });

  it('rolls weight above 150 with 150 + 1d20', () => {
    expect(rollWeight('max', lowest)).toBe(151);
    expect(rollWeight('max', highest)).toBe(170);
  });
});

describe('size factor bands', () => {
  it('keeps the integer boundaries', () => {
    expect(weightFactor(70)).toBe(1);
    expect(weightFactor(71)).toBe(2);
    expect(weightFactor(150)).toBe(4);
    expect(weightFactor(151)).toBe(5);
    expect(heightFactor(149)).toBe(0);
    expect(heightFactor(150)).toBe(1);
    expect(heightFactor(250)).toBe(4);
    expect(heightFactor(251)).toBe(5);
  });
});

describe('ofícios', () => {
  it('includes Pária with its four skills', () => {
    expect(
      OFICIOS.find((entry) => entry.name === 'Pária')?.affectedSkills,
    ).toEqual(['Fortitude', 'Vitalidade', 'Presença', 'Pressentimento']);
  });

  it('lists Operário with Tolerância, Pressentimento and Empatia', () => {
    expect(
      OFICIOS.find((entry) => entry.name === 'Operário')?.affectedSkills,
    ).toEqual(['Fortitude', 'Tolerância', 'Pressentimento', 'Empatia']);
  });

  it('only cites skills that exist in the catalog', () => {
    expect(SKILLS.map((skill) => skill.name)).toEqual(
      expect.arrayContaining([
        'Fortitude',
        'Vitalidade',
        'Presença',
        'Pressentimento',
        'Tolerância',
        'Empatia',
      ]),
    );
  });
});

describe('affliction keys', () => {
  it('match the affliction definitions', () => {
    expect(AFFLICTIONS.map((entry) => entry.key)).toEqual([...AFFLICTION_KEYS]);
  });
});
