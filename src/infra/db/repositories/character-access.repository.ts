import { and, eq } from 'drizzle-orm';
import type { AttributeKey } from '@shared/rules/attributes.js';
import type {
  CharacterAccess,
  CharacterSkillRef,
  CharacterSnapshot,
  VitalsChangeLog,
  EffortChangeResult,
  HpChangeResult,
  SkillRef,
} from '@modules/chat/character-access.contract.js';
import { ChatCharacterNotFoundError } from '@modules/chat/chat.errors.js';
import { db } from '../index.js';
import { character, characterSkill, skill } from '../schema.js';
import {
  changeLockedCharacterEffort,
  changeLockedCharacterHp,
} from './character-vitals.js';

type CharacterRow = typeof character.$inferSelect;

function toSnapshot(row: CharacterRow): CharacterSnapshot {
  const attributes: Record<AttributeKey, number> = {
    cognition: row.cognition,
    psyche: row.psyche,
    instinct: row.instinct,
    constitution: row.constitution,
    motricity: row.motricity,
    perception: row.perception,
  };

  return {
    id: row.id,
    gameId: row.gameId,
    playerId: row.playerId,
    name: row.nickname,
    currentHp: row.currentHp,
    maxHp: row.maxHp,
    currentEffort: row.currentEffort,
    maxEffort: row.maxEffort,
    bExp: row.bExp,
    attributes,
  };
}

export function characterAccessRepository(): CharacterAccess {
  return {
    async findById(characterId: string): Promise<CharacterSnapshot | null> {
      const [row] = await db
        .select()
        .from(character)
        .where(eq(character.id, characterId))
        .limit(1);

      return row ? toSnapshot(row) : null;
    },

    async findSkillById(skillId: string): Promise<SkillRef | null> {
      const [row] = await db
        .select({ id: skill.id, attribute: skill.attribute })
        .from(skill)
        .where(eq(skill.id, skillId))
        .limit(1);

      return row ?? null;
    },

    async findSkillForCharacter(
      characterId: string,
      skillId: string,
    ): Promise<CharacterSkillRef | null> {
      const [row] = await db
        .select({
          skillId: characterSkill.skillId,
          proficiencyBonus: characterSkill.proficiencyBonus,
        })
        .from(characterSkill)
        .where(
          and(
            eq(characterSkill.characterId, characterId),
            eq(characterSkill.skillId, skillId),
          ),
        )
        .limit(1);

      return row ?? null;
    },

    async changeEffort(
      characterId: string,
      delta: number,
      log: VitalsChangeLog,
    ): Promise<EffortChangeResult> {
      const change = await changeLockedCharacterEffort(
        db,
        characterId,
        delta,
        log,
      );
      if (!change) throw new ChatCharacterNotFoundError();

      return {
        oldEffort: change.oldEffort,
        newEffort: change.row.currentEffort,
        oldHp: change.oldHp,
        newHp: change.row.currentHp,
      };
    },

    async changeHp(
      characterId: string,
      delta: number,
      log: VitalsChangeLog,
    ): Promise<HpChangeResult> {
      const change = await changeLockedCharacterHp(db, characterId, delta, log);
      if (!change) throw new ChatCharacterNotFoundError();

      return { oldHp: change.oldHp, newHp: change.row.currentHp };
    },
  };
}
