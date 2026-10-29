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

export interface HpChangeResult {
  oldHp: number;
  newHp: number;
}

export interface EffortChangeResult {
  oldEffort: number;
  newEffort: number;
  oldHp: number;
  newHp: number;
}

export interface VitalsChangeLog {
  sessionId: string;
  playerId: string;
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
   * Applies a PE gain or recovery to the locked character row: effort capped
   * at the limit, each excess point costs 1 PS. Effort, HP, version and the
   * log rows commit together.
   */
  changeEffort(
    characterId: string,
    delta: number,
    log: VitalsChangeLog,
  ): Promise<EffortChangeResult>;
  /**
   * Applies a PS delta to the locked character row: clamp(current + delta, 0,
   * maxHp). HP, version and the log row commit together.
   */
  changeHp(
    characterId: string,
    delta: number,
    log: VitalsChangeLog,
  ): Promise<HpChangeResult>;
}
