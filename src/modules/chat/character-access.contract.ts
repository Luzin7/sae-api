import type { AttributeKey } from '@shared/rules/attributes.js';
import type { AppendSessionLogInput } from './chat.repository.js';

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
  name: string;
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

export interface HpDamageResult {
  previousHp: number;
  character: CharacterSnapshot;
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
  /**
   * Writes the new HP and the log row describing it in one transaction, so a
   * change without its log (or the reverse) can never commit.
   */
  updateHpWithLog(
    characterId: string,
    newHp: number,
    log: AppendSessionLogInput,
  ): Promise<CharacterSnapshot>;
  /** Decrements the stored HP in SQL so concurrent hits cannot overwrite each other. */
  damageHp(characterId: string, damage: number): Promise<HpDamageResult>;
}
