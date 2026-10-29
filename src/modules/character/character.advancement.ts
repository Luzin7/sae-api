import {
  ATTRIBUTE_NAMES,
  type AttributeKey,
} from '@shared/rules/attributes.js';
import { proficiencyPool } from '@shared/rules/proficiency.js';
import {
  EmptyAdvancementError,
  SpentPointsLockedError,
} from './character.errors.js';
import {
  attributeBudget,
  attributePointsSpent,
} from './character.attributes.js';
import type {
  AttributeScores,
  Character,
  CharacterSkillDetail,
  ProficiencyScores,
  UpsertSkillInput,
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

export interface AdvancementRequest {
  attributes: Partial<AttributeScores>;
  skills: readonly UpsertSkillInput[];
}

function savedBonus(
  saved: readonly CharacterSkillDetail[],
  skillId: string,
): number {
  return (
    saved.find((entry) => entry.skillId === skillId)?.proficiencyBonus ?? 0
  );
}

export function increasedSkills(
  saved: readonly CharacterSkillDetail[],
  requested: readonly UpsertSkillInput[],
): UpsertSkillInput[] {
  return requested.filter(
    (entry) => entry.proficiencyBonus > savedBonus(saved, entry.skillId),
  );
}

function increasedAttributes(
  current: AttributeScores,
  requested: Partial<AttributeScores>,
): AttributeKey[] {
  return ATTRIBUTE_NAMES.filter(
    (name) => (requested[name] ?? current[name]) > current[name],
  );
}

function hasLoweredPoints(
  current: AttributeScores,
  saved: readonly CharacterSkillDetail[],
  request: AdvancementRequest,
): boolean {
  const loweredAttribute = ATTRIBUTE_NAMES.some(
    (name) => (request.attributes[name] ?? current[name]) < current[name],
  );
  const loweredSkill = request.skills.some(
    (entry) => entry.proficiencyBonus < savedBonus(saved, entry.skillId),
  );

  return loweredAttribute || loweredSkill;
}

export function assertAddOnly(
  current: AttributeScores,
  saved: readonly CharacterSkillDetail[],
  request: AdvancementRequest,
): void {
  if (hasLoweredPoints(current, saved, request)) {
    throw new SpentPointsLockedError();
  }

  const raisesAttribute =
    increasedAttributes(current, request.attributes).length > 0;
  if (raisesAttribute || increasedSkills(saved, request.skills).length > 0) {
    return;
  }

  throw new EmptyAdvancementError();
}
