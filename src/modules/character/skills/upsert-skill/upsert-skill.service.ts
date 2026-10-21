import { proficiencyPool } from '@shared/rules/proficiency.js';
import { requireOwnedCharacter } from '../../character.authorization.js';
import type {
  AttributeName,
  CharacterSkill,
  UpsertSkillInput,
} from '../../character.entity.js';
import {
  SkillNotFoundError,
  SkillPoolExceededError,
} from '../../character.errors.js';
import type { CharacterRepository } from '../../character.repository.js';
import { proficiencyLevelFor } from '../proficiency-field.js';

export class UpsertSkillService {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(
    characterId: string,
    requesterId: string,
    input: UpsertSkillInput,
  ): Promise<CharacterSkill> {
    const character = await requireOwnedCharacter(
      this.characters,
      characterId,
      requesterId,
    );
    const skill = await this.characters.findSkillById(input.skillId);
    if (!skill) throw new SkillNotFoundError();

    const pool = proficiencyPool(
      proficiencyLevelFor(character, skill.attribute),
      character.np,
    );
    const spent = await this.spentOnAttribute(
      characterId,
      skill.attribute,
      input.skillId,
    );
    if (spent + input.proficiencyBonus > pool) {
      throw new SkillPoolExceededError(
        skill.attribute,
        pool,
        spent + input.proficiencyBonus,
      );
    }

    return this.characters.upsertSkill(
      characterId,
      input.skillId,
      input.proficiencyBonus,
    );
  }

  private async spentOnAttribute(
    characterId: string,
    attribute: AttributeName,
    exceptSkillId: string,
  ): Promise<number> {
    const details = await this.characters.findSkillDetails(characterId);

    return details
      .filter(
        (entry) =>
          entry.attribute === attribute && entry.skillId !== exceptSkillId,
      )
      .reduce((total, entry) => total + entry.proficiencyBonus, 0);
  }
}
