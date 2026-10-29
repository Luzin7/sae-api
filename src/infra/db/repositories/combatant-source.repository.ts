import { and, eq } from 'drizzle-orm';
import type {
  CombatantRef,
  CombatantSource,
  MonsterRef,
  MonsterTemplate,
} from '@modules/chat/combatant-source.contract.js';
import { db, type Database } from '../index.js';
import { character, game, monster } from '../schema.js';

type MonsterAttributesAndVitals = {
  cognition: number;
  psyche: number;
  instinct: number;
  constitution: number;
  motricity: number;
  perception: number;
  currentHp: number;
  maxHp: number;
  currentEffort: number;
  maxEffort: number;
};

type MonsterRow = {
  id: string;
  name: string;
  gameId: string | null;
  createdBy: string;
} & MonsterAttributesAndVitals;

async function findCharacter(
  database: Database,
  gameId: string,
  refId: string,
): Promise<CombatantRef | null> {
  const [row] = await database
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
  database: Database,
  gameId: string,
  refId: string,
): Promise<CombatantRef | null> {
  const [row] = await database
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

async function findGameMasterId(
  database: Database,
  gameId: string,
): Promise<string | null> {
  const [row] = await database
    .select({ masterId: game.masterId })
    .from(game)
    .where(eq(game.id, gameId))
    .limit(1);

  return row?.masterId ?? null;
}

function toMonsterTemplate(row: MonsterAttributesAndVitals): MonsterTemplate {
  return {
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
}

function toMonsterRef(row: MonsterRow): MonsterRef {
  return {
    id: row.id,
    name: row.name,
    ...toMonsterTemplate(row),
    afflictions: [],
  };
}

export function combatantSourceRepository(
  database: Database = db,
): CombatantSource {
  return {
    async listByGame(gameId: string): Promise<CombatantRef[]> {
      const [characters, monsters] = await Promise.all([
        database
          .select({
            id: character.id,
            nickname: character.nickname,
            playerId: character.playerId,
          })
          .from(character)
          .where(eq(character.gameId, gameId)),
        database
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
          .where(eq(monster.gameId, gameId)),
      ]);

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
        template: toMonsterTemplate(row),
      }));

      return [...characterRefs, ...monsterRefs];
    },

    async findByRef(gameId, kind, refId) {
      if (kind === 'character') return findCharacter(database, gameId, refId);

      return findMonster(database, gameId, refId);
    },

    async findMonsterInGame(
      gameId: string,
      monsterId: string,
    ): Promise<MonsterRef | null> {
      const [row] = await database
        .select({
          id: monster.id,
          name: monster.name,
          gameId: monster.gameId,
          createdBy: monster.createdBy,
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
        .where(eq(monster.id, monsterId))
        .limit(1);
      if (!row) return null;

      const reachable = await isReachableByGame(database, gameId, row);
      if (!reachable) return null;

      return toMonsterRef(row);
    },
  };
}

async function isReachableByGame(
  database: Database,
  gameId: string,
  row: MonsterRow,
): Promise<boolean> {
  if (row.gameId === gameId) return true;
  if (row.gameId !== null) return false;

  const masterId = await findGameMasterId(database, gameId);

  return masterId !== null && masterId === row.createdBy;
}
