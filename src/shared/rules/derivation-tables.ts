import {
  scaleAttributeDice,
  type AttributeDice,
} from '../dice/attribute-dice.js';
import { ATTRIBUTE_SCALE, type AttributeValue } from './attributes.js';
import {
  PROFICIENCY_LEVELS,
  proficiencyPool,
  skillBonusCap,
  type ProficiencyLevel,
} from './proficiency.js';
import {
  ABOVE_EXACT_DIE_SIDES,
  BELOW_EXACT_DIE_SIDES,
  HEIGHT_EXACT_MAX,
  HEIGHT_EXACT_MIN,
  WEIGHT_EXACT_MAX,
  WEIGHT_EXACT_MIN,
} from './size.js';
import {
  bExp,
  CONDICIONAMENTO,
  hitDie,
  MAX_EFFORT_BASE,
  MAX_HP_BASE,
  VITALIDADE,
  type HitDie,
} from './vitals.js';

export const MAX_NP = 20;

export interface ValueRange {
  min: number;
  max: number;
}

export interface BodyDimensionRule {
  unit: 'cm' | 'kg';
  exact: ValueRange;
  below: ValueRange;
  above: ValueRange;
}

export interface VitalFormula {
  base: number;
  skill: string;
}

export interface DerivationTables {
  bodyDimensions: { height: BodyDimensionRule; weight: BodyDimensionRule };
  attributeDice: Record<AttributeValue, AttributeDice>;
  hitDieByConstitution: Record<AttributeValue, { die: HitDie; max: number }>;
  proficiencyPoolByNp: Record<ProficiencyLevel, number[]>;
  skillCapByLevel: Record<ProficiencyLevel, number>;
  bExpByNp: number[];
  vitalFormulas: { maxHp: VitalFormula; maxEffort: VitalFormula };
}

function bodyDimension(
  unit: BodyDimensionRule['unit'],
  exactMin: number,
  exactMax: number,
): BodyDimensionRule {
  return {
    unit,
    exact: { min: exactMin, max: exactMax },
    below: { min: exactMin - BELOW_EXACT_DIE_SIDES, max: exactMin - 1 },
    above: { min: exactMax + 1, max: exactMax + ABOVE_EXACT_DIE_SIDES },
  };
}

function byAttributeValue<T>(
  build: (value: AttributeValue) => T,
): Record<AttributeValue, T> {
  return Object.fromEntries(
    ATTRIBUTE_SCALE.map((value) => [value, build(value)]),
  ) as Record<AttributeValue, T>;
}

/** Index 0 is unused; index NP holds the value for that NP. */
function byNp(build: (np: number) => number): number[] {
  return Array.from({ length: MAX_NP + 1 }, (_, np) => build(np));
}

export function derivationTables(): DerivationTables {
  return {
    bodyDimensions: {
      height: bodyDimension('cm', HEIGHT_EXACT_MIN, HEIGHT_EXACT_MAX),
      weight: bodyDimension('kg', WEIGHT_EXACT_MIN, WEIGHT_EXACT_MAX),
    },
    attributeDice: byAttributeValue(scaleAttributeDice),
    hitDieByConstitution: byAttributeValue(hitDie),
    proficiencyPoolByNp: Object.fromEntries(
      PROFICIENCY_LEVELS.map(({ key }) => [
        key,
        byNp((np) => proficiencyPool(key, np)),
      ]),
    ) as Record<ProficiencyLevel, number[]>,
    skillCapByLevel: Object.fromEntries(
      PROFICIENCY_LEVELS.map(({ key }) => [key, skillBonusCap(key)]),
    ) as Record<ProficiencyLevel, number>,
    bExpByNp: byNp(bExp),
    vitalFormulas: {
      maxHp: { base: MAX_HP_BASE, skill: VITALIDADE },
      maxEffort: { base: MAX_EFFORT_BASE, skill: CONDICIONAMENTO },
    },
  };
}
