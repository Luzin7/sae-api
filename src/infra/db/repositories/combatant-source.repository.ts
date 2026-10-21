import { and, eq } from 'drizzle-orm';
import type {
  CombatantRef,
  CombatantSource,
  MonsterRef,
} from '@modules/chat/combatant-source.contract.js';
import { db } from '../index.js';
import { character, monster } from '../schema.js';

async function findCharacter(
  gameId: string,
  refId: string,
): Promise<CombatantRef | null> {
  const [row] = await db
    .select({
      id: character.id,
      nickname: character.nickname,
      playerId: character.playerId,
    })
    .from(character)
    .where(and(eq(character.gameId, gameId), eq(character.id, refId)))
    .limit(1);
  if (!row) return null;

  return {
    kind: 'character',
    refId: row.id,
    name: row.nickname,
    ownerPlayerId: row.playerId,
  };
}

async function findMonster(
  gameId: string,
  refId: string,
): Promise<CombatantRef | null> {
  const [row] = await db
    .select({ id: monster.id, name: monster.name })
    .from(monster)
    .where(and(eq(monster.gameId, gameId), eq(monster.id, refId)))
    .limit(1);
  if (!row) return null;

  return {
    kind: 'monster',
    refId: row.id,
    name: row.name,
    ownerPlayerId: null,
  };
}

export function combatantSourceRepository(): CombatantSource {
  return {
    async listByGame(gameId: string): Promise<CombatantRef[]> {
      const characters = await db
        .select({
          id: character.id,
          nickname: character.nickname,
          playerId: character.playerId,
        })
        .from(character)
        .where(eq(character.gameId, gameId));
      const monsters = await db
        .select({ id: monster.id, name: monster.name })
        .from(monster)
        .where(eq(monster.gameId, gameId));

      const characterRefs: CombatantRef[] = characters.map((row) => ({
        kind: 'character',
        refId: row.id,
        name: row.nickname,
        ownerPlayerId: row.playerId,
      }));
      const monsterRefs: CombatantRef[] = monsters.map((row) => ({
        kind: 'monster',
        refId: row.id,
        name: row.name,
        ownerPlayerId: null,
      }));

      return [...characterRefs, ...monsterRefs];
    },

    async findByRef(gameId, kind, refId) {
      if (kind === 'character') return findCharacter(gameId, refId);

      return findMonster(gameId, refId);
    },

    async findMonsterInGame(
      gameId: string,
      monsterId: string,
    ): Promise<MonsterRef | null> {
      const [row] = await db
        .select({
          id: monster.id,
          name: monster.name,
          cognition: monster.cognition,
          psyche: monster.psyche,
          instinct: monster.instinct,
          constitution: monster.constitution,
          motricity: monster.motricity,
          perception: monster.perception,
          currentHp: monster.currentHp,
          maxHp: monster.maxHp,
          currentEffort: monster.currentEffort,
          maxEffort: monster.maxEffort,
        })
        .from(monster)
        .where(and(eq(monster.gameId, gameId), eq(monster.id, monsterId)))
        .limit(1);
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        attributes: {
          cognition: row.cognition,
          psyche: row.psyche,
          instinct: row.instinct,
          constitution: row.constitution,
          motricity: row.motricity,
          perception: row.perception,
        },
        currentHp: row.currentHp,
        maxHp: row.maxHp,
        currentEffort: row.currentEffort,
        maxEffort: row.maxEffort,
      };
    },

    async saveMonsterVitals(monsterId, patch) {
      await db
        .update(monster)
        .set({ currentHp: patch.currentHp, currentEffort: patch.currentEffort })
        .where(eq(monster.id, monsterId));
    },
  };
}
