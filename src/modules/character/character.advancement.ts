import {
  ATTRIBUTE_NAMES,
  type AttributeKey,
} from '@shared/rules/attributes.js';
import { proficiencyPool } from '@shared/rules/proficiency.js';
import {
  attributeBudget,
  attributePointsSpent,
} from './character.attributes.js';
import type {
  AttributeScores,
  Character,
  ProficiencyScores,
} from './character.entity.js';
import { proficiencyLevelFor } from './skills/proficiency-field.js';

export interface PointBalance {
  budget: number;
  spent: number;
  remaining: number;
}

export interface AdvancementBalance {
  attributePoints: PointBalance;
  skillPoints: Record<AttributeKey, PointBalance>;
}

export interface SkillSpend {
  attribute: AttributeKey;
  spent: number;
}

export type AdvancementSheet = Pick<Character, 'np'> &
  AttributeScores &
  ProficiencyScores;

function pointBalance(budget: number, spent: number): PointBalance {
  return { budget, spent, remaining: budget - spent };
}

export function advancementBalance(
  sheet: AdvancementSheet,
  skillSpend: readonly SkillSpend[],
): AdvancementBalance {
  const skillPoints = Object.fromEntries(
    ATTRIBUTE_NAMES.map((attribute) => {
      const spent = skillSpend
        .filter((entry) => entry.attribute === attribute)
        .reduce((total, entry) => total + entry.spent, 0);
      const pool = proficiencyPool(
        proficiencyLevelFor(sheet, attribute),
        sheet.np,
      );

      return [attribute, pointBalance(pool, spent)];
    }),
  ) as Record<AttributeKey, PointBalance>;

  return {
    attributePoints: pointBalance(
      attributeBudget(sheet.np),
      attributePointsSpent(sheet),
    ),
    skillPoints,
  };
}
