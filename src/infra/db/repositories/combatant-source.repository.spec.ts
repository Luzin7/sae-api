import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Database } from '../index.js';
import { combatantSourceRepository } from './combatant-source.repository.js';

type Row = Record<string, unknown>;

function fakeDatabase(rows: { character: Row[]; monster: Row[] }) {
  const queried: string[] = [];
  let inFlight = 0;
  let peakInFlight = 0;

  const database = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const name = getTableName(table as never);
          const result = rows[name as keyof typeof rows] ?? [];
          queried.push(name);
          inFlight += 1;
          peakInFlight = Math.max(peakInFlight, inFlight);

          return Promise.resolve(result).finally(() => {
            inFlight -= 1;
          });
        },
      }),
    }),
  } as unknown as Database;

  return { database, queried, peakInFlight: () => peakInFlight };
}

describe('combatantSourceRepository.listByGame', () => {
  it('returns characters and monsters from one round-trip each', async () => {
    const fake = fakeDatabase({
      character: [{ id: 'c-1', nickname: 'Ana', playerId: 'p-1' }],
      monster: [{ id: 'm-1', name: 'Goblin' }],
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
      { kind: 'monster', refId: 'm-1', name: 'Goblin', ownerPlayerId: null },
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
