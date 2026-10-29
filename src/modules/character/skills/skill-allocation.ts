import {
  ATTRIBUTE_NAMES,
  type AttributeKey,
} from '@shared/rules/attributes.js';
import { proficiencyPool, skillBonusCap } from '@shared/rules/proficiency.js';
import type {
  CharacterSkillDetail,
  ProficiencyScores,
  UpsertSkillInput,
} from '../character.entity.js';
import {
  SkillBonusCapExceededError,
  SkillNotFoundError,
  SkillPoolExceededError,
} from '../character.errors.js';
import type { CharacterRepository } from '../character.repository.js';
import { proficiencyLevelFor } from './proficiency-field.js';

export type SkillAllocationDetail = Pick<
  CharacterSkillDetail,
  'skillId' | 'skillName' | 'attribute' | 'proficiencyBonus'
>;

export interface SkillPoolOverrun {
  attribute: AttributeKey;
  pool: number;
  spent: number;
}

export function skillPoolOverruns(
  proficiencies: ProficiencyScores,
  np: number,
  skills: readonly SkillAllocationDetail[],
): SkillPoolOverrun[] {
  return ATTRIBUTE_NAMES.map((attribute) => ({
    attribute,
    pool: proficiencyPool(proficiencyLevelFor(proficiencies, attribute), np),
    spent: skills
      .filter((skill) => skill.attribute === attribute)
      .reduce((total, skill) => total + skill.proficiencyBonus, 0),
  })).filter(({ pool, spent }) => spent > pool);
}

export function assertSkillPools(
  proficiencies: ProficiencyScores,
  np: number,
  skills: readonly SkillAllocationDetail[],
): void {
  const [first] = skillPoolOverruns(proficiencies, np, skills);
  if (!first) return;

  throw new SkillPoolExceededError(first.attribute, first.pool, first.spent);
}

export function assertSkillBonusCaps(
  proficiencies: ProficiencyScores,
  allocations: readonly SkillAllocationDetail[],
): void {
  for (const allocation of allocations) {
    const cap = skillBonusCap(
      proficiencyLevelFor(proficiencies, allocation.attribute),
    );
    if (allocation.proficiencyBonus > cap) {
      throw new SkillBonusCapExceededError(allocation.skillName, cap);
    }
  }
}

export async function resolveSkillAllocations(
  characters: Pick<CharacterRepository, 'findSkillsByIds'>,
  requested: readonly UpsertSkillInput[],
): Promise<SkillAllocationDetail[]> {
  if (requested.length === 0) return [];

  const found = await characters.findSkillsByIds(
    requested.map((entry) => entry.skillId),
  );
  if (found.length !== requested.length) throw new SkillNotFoundError();

  return requested.map((entry) => {
    const skill = found.find((candidate) => candidate.id === entry.skillId);
    if (!skill) throw new SkillNotFoundError();

    return {
      skillId: skill.id,
      skillName: skill.name,
      attribute: skill.attribute,
      proficiencyBonus: entry.proficiencyBonus,
    };
  });
}
