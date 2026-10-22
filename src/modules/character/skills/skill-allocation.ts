import { ATTRIBUTE_NAMES } from '@shared/rules/attributes.js';
import { proficiencyPool, skillBonusCap } from '@shared/rules/proficiency.js';
import type {
  CharacterSkillDetail,
  ProficiencyScores,
} from '../character.entity.js';
import {
  SkillBonusCapExceededError,
  SkillPoolExceededError,
} from '../character.errors.js';
import { proficiencyLevelFor } from './proficiency-field.js';

export type SkillAllocationDetail = Pick<
  CharacterSkillDetail,
  'skillId' | 'skillName' | 'attribute' | 'proficiencyBonus'
>;

export function assertSkillPools(
  proficiencies: ProficiencyScores,
  np: number,
  skills: readonly SkillAllocationDetail[],
): void {
  for (const attribute of ATTRIBUTE_NAMES) {
    const pool = proficiencyPool(
      proficiencyLevelFor(proficiencies, attribute),
      np,
    );
    const spent = skills
      .filter((skill) => skill.attribute === attribute)
      .reduce((total, skill) => total + skill.proficiencyBonus, 0);
    if (spent > pool) throw new SkillPoolExceededError(attribute, pool, spent);
  }
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
