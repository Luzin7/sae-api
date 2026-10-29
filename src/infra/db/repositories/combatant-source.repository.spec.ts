import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Database } from '../index.js';
import { combatantSourceRepository } from './combatant-source.repository.js';

type Row = Record<string, unknown>;

type Tables = { character?: Row[]; monster?: Row[]; game?: Row[] };

function fakeDatabase(rows: Tables) {
  const queried: string[] = [];
  let inFlight = 0;
  let peakInFlight = 0;

  function start(table: unknown): Promise<Row[]> {
    const name = getTableName(table as never);
    const result = rows[name as keyof Tables] ?? [];
    queried.push(name);
    inFlight += 1;
    peakInFlight = Math.max(peakInFlight, inFlight);

    return Promise.resolve(result).finally(() => {
      inFlight -= 1;
    });
  }

  const database = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const pending = start(table);

          return {
            then: pending.then.bind(pending),
            catch: pending.catch.bind(pending),
            finally: pending.finally.bind(pending),
            limit: (count: number) =>
              pending.then((all) => all.slice(0, count)),
          };
        },
      }),
    }),
  } as unknown as Database;

  return { database, queried, peakInFlight: () => peakInFlight };
}

const MONSTER_ROW: Row = {
  id: 'm-1',
  name: 'Goblin',
  gameId: null,
  createdBy: 'master-1',
  cognition: 2,
  psyche: -2,
  instinct: 0,
  constitution: 3,
  motricity: 1,
  perception: 0,
  currentHp: 20,
  maxHp: 20,
  maxEffort: 10,
};

describe('combatantSourceRepository.listByGame', () => {
  it('returns characters and monsters from one round-trip each', async () => {
    const fake = fakeDatabase({
      character: [{ id: 'c-1', nickname: 'Ana', playerId: 'p-1' }],
      monster: [
        {
          id: 'm-1',
          name: 'Goblin',
          cognition: 2,
          psyche: -2,
          instinct: 0,
          constitution: 3,
          motricity: 1,
          perception: 0,
          currentHp: 20,
          maxHp: 20,
          maxEffort: 10,
        },
      ],
    });

    const refs = await combatantSourceRepository(fake.database).listByGame(
      'g-1',
    );

    expect(refs).toEqual([
      {
        kind: 'character',
        refId: 'c-1',
        name: 'Ana',
        ownerPlayerId: 'p-1',
      },
      {
        kind: 'monster',
        refId: 'm-1',
        name: 'Goblin',
        ownerPlayerId: null,
        template: {
          attributes: {
            cognition: 2,
            psyche: -2,
            instinct: 0,
            constitution: 3,
            motricity: 1,
            perception: 0,
          },
          currentHp: 20,
          maxHp: 20,
          maxEffort: 10,
        },
      },
    ]);
    expect(fake.queried).toEqual(['character', 'monster']);
    expect(fake.peakInFlight()).toBe(2);
  });

  it('returns an empty list for a game without combatants', async () => {
    const fake = fakeDatabase({ character: [], monster: [] });

    const refs = await combatantSourceRepository(fake.database).listByGame(
      'g-1',
    );

    expect(refs).toEqual([]);
    expect(fake.queried).toEqual(['character', 'monster']);
  });
});

describe('combatantSourceRepository.findMonsterInGame', () => {
  it("resolves a reusable entry owned by the game's master", async () => {
    const fake = fakeDatabase({
      monster: [MONSTER_ROW],
      game: [{ id: 'g-1', masterId: 'master-1' }],
    });

    const ref = await combatantSourceRepository(
      fake.database,
    ).findMonsterInGame('g-1', 'm-1');

    expect(ref).toEqual({
      id: 'm-1',
      name: 'Goblin',
      attributes: {
        cognition: 2,
        psyche: -2,
        instinct: 0,
        constitution: 3,
        motricity: 1,
        perception: 0,
      },
      currentHp: 20,
      maxHp: 20,
      maxEffort: 10,
      afflictions: [],
    });
    expect(fake.queried).toEqual(['monster', 'game']);
  });

  it('refuses a reusable entry owned by another master', async () => {
    const fake = fakeDatabase({
      monster: [{ ...MONSTER_ROW, createdBy: 'master-2' }],
      game: [{ id: 'g-1', masterId: 'master-1' }],
    });

    const ref = await combatantSourceRepository(
      fake.database,
    ).findMonsterInGame('g-1', 'm-1');

    expect(ref).toBeNull();
  });

  it("resolves the game's own entry without asking for its master", async () => {
    const fake = fakeDatabase({
      monster: [{ ...MONSTER_ROW, gameId: 'g-1' }],
      game: [{ id: 'g-1', masterId: 'master-1' }],
    });

    const ref = await combatantSourceRepository(
      fake.database,
    ).findMonsterInGame('g-1', 'm-1');

    expect(ref?.id).toBe('m-1');
    expect(fake.queried).toEqual(['monster']);
  });

  it("refuses another game's entry", async () => {
    const fake = fakeDatabase({
      monster: [{ ...MONSTER_ROW, gameId: 'g-2' }],
      game: [{ id: 'g-1', masterId: 'master-1' }],
    });

    const ref = await combatantSourceRepository(
      fake.database,
    ).findMonsterInGame('g-1', 'm-1');

    expect(ref).toBeNull();
  });
});
