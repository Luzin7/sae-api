import { attributeDisplayName } from '@shared/rules/attributes.js';
import {
  attributeBudget,
  attributePointsSpent,
} from './character.attributes.js';
import type {
  AttributeScores,
  CharacterSkillDetail,
  ProficiencyScores,
} from './character.entity.js';
import { NpReductionBlockedError } from './character.errors.js';
import { skillPoolOverruns } from './skills/skill-allocation.js';

interface NpReduction {
  oldNp: number;
  newNp: number;
  attributes: AttributeScores;
  proficiencies: ProficiencyScores;
  skills: readonly CharacterSkillDetail[];
}

export function assertNpReductionFits(reduction: NpReduction): void {
  const { oldNp, newNp, attributes, proficiencies, skills } = reduction;
  if (newNp >= oldNp) return;

  const overruns: string[] = [];
  const attributeSpent = attributePointsSpent(attributes);
  const budget = attributeBudget(newNp);
  if (attributeSpent > budget) {
    overruns.push(`Pontos de Atributo usam ${attributeSpent} de ${budget}.`);
  }
  for (const { attribute, pool, spent } of skillPoolOverruns(
    proficiencies,
    newNp,
    skills,
  )) {
    overruns.push(
      `Perícias de ${attributeDisplayName(attribute)} usam ${spent} de ${pool}.`,
    );
  }

  if (overruns.length > 0) throw new NpReductionBlockedError(overruns);
}
