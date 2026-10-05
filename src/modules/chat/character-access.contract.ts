import type { AttributeKey } from '@shared/rules/attributes.js';

/**
 * Consumer-owned cross-domain contract. The realtime slice needs to resolve a
 * character's vitals and the dice inputs (attribute value, skill bonus, BExp)
 * server-side. The adapter lives in infra and reads `character`,
 * `character_skill` and `skill` directly, so no slice imports another.
 */
export interface CharacterSnapshot {
  id: string;
  gameId: string;
  playerId: string;
  currentHp: number;
  maxHp: number;
  currentEffort: number;
  maxEffort: number;
  bExp: number;
  attributes: Record<AttributeKey, number>;
}

export interface SkillRef {
  id: string;
  attribute: AttributeKey;
}

export interface CharacterSkillRef {
  skillId: string;
  proficiencyBonus: number;
}

export interface CharacterAccess {
  findById(characterId: string): Promise<CharacterSnapshot | null>;
  findSkillById(skillId: string): Promise<SkillRef | null>;
  findSkillForCharacter(
    characterId: string,
    skillId: string,
  ): Promise<CharacterSkillRef | null>;
  updateHp(characterId: string, newHp: number): Promise<void>;
}
