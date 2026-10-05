import { describe, expect, it } from 'vitest';
import type { Player, UpdatePlayerInput } from './player.entity.js';
import { PlayerNotFoundError } from './player.errors.js';
import type { PlayerRepository } from './player.repository.js';

// Contract note: the features are tested against an in-memory fake of this
// repository (see the per-feature specs). The real Drizzle adapter lives in
// src/infra/db/repositories/player.repository.ts and is covered by integration
// tests against Postgres next to that adapter.
function makeInMemoryRepository(seed: Player[] = []): PlayerRepository {
  const rows = new Map(seed.map((row) => [row.id, row]));

  return {
    async findById(id: string): Promise<Player | null> {
      return rows.get(id) ?? null;
    },

    async findByName(name: string): Promise<Player | null> {
      return [...rows.values()].find((row) => row.name === name) ?? null;
    },

    async save(id: string, input: UpdatePlayerInput): Promise<Player> {
      const existing = rows.get(id);
      if (!existing) throw new PlayerNotFoundError();

      const updated: Player = {
        ...existing,
        name: input.name,
        updatedAt: new Date('2024-02-01T00:00:00.000Z'),
      };
      rows.set(id, updated);

      return updated;
    },
  };
}

const seed: Player = {
  id: 'player-1',
  name: 'Alice',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
};

describe('PlayerRepository contract (in-memory fake)', () => {
  it('findById returns the stored entity', async () => {
    const players = makeInMemoryRepository([seed]);
    await expect(players.findById(seed.id)).resolves.toEqual(seed);
  });

  it('findById returns null when absent', async () => {
    const players = makeInMemoryRepository();
    await expect(players.findById('missing')).resolves.toBeNull();
  });

  it('findByName matches the display name', async () => {
    const players = makeInMemoryRepository([seed]);
    await expect(players.findByName('Alice')).resolves.toEqual(seed);
    await expect(players.findByName('Bob')).resolves.toBeNull();
  });

  it('save updates the name and returns the entity', async () => {
    const players = makeInMemoryRepository([seed]);
    const updated = await players.save(seed.id, { name: 'NewName' });

    expect(updated.name).toBe('NewName');
    expect(updated.id).toBe(seed.id);
    await expect(players.findByName('NewName')).resolves.toEqual(updated);
  });

  it('save throws PlayerNotFoundError for an unknown id', async () => {
    const players = makeInMemoryRepository();
    await expect(
      players.save('missing', { name: 'NewName' }),
    ).rejects.toBeInstanceOf(PlayerNotFoundError);
  });
});
