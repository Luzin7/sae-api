import { and, eq, sql } from 'drizzle-orm';
import type { AttributeKey } from '@shared/rules/attributes.js';
import type {
  CharacterAccess,
  CharacterSkillRef,
  CharacterSnapshot,
  HpDamageResult,
  SkillRef,
} from '@modules/chat/character-access.contract.js';
import {
  ChatCharacterNotFoundError,
  InvalidHpError,
} from '@modules/chat/chat.errors.js';
import type { AppendSessionLogInput } from '@modules/chat/chat.repository.js';
import { db } from '../index.js';
import { character, characterSkill, skill } from '../schema.js';
import { insertSessionLog } from './session-log.js';

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

    async updateHpWithLog(
      characterId: string,
      newHp: number,
      log: AppendSessionLogInput,
    ): Promise<CharacterSnapshot> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(character)
          .set({ currentHp: newHp, updatedAt: new Date() })
          .where(eq(character.id, characterId))
          .returning();
        if (!row) throw new ChatCharacterNotFoundError();

        await insertSessionLog(tx, log);

        return toSnapshot(row);
      });
    },

    async damageHp(
      characterId: string,
      damage: number,
    ): Promise<HpDamageResult> {
      if (!Number.isInteger(damage) || damage <= 0) throw new InvalidHpError();

      return db.transaction(async (tx) => {
        const [locked] = await tx
          .select({ currentHp: character.currentHp })
          .from(character)
          .where(eq(character.id, characterId))
          .for('update');
        if (!locked) throw new ChatCharacterNotFoundError();

        const [row] = await tx
          .update(character)
          .set({
            currentHp: sql`GREATEST(0, ${character.currentHp} - ${damage})`,
            updatedAt: new Date(),
          })
          .where(eq(character.id, characterId))
          .returning();
        if (!row) throw new ChatCharacterNotFoundError();

        return { previousHp: locked.currentHp, character: toSnapshot(row) };
      });
    },
  };
}
