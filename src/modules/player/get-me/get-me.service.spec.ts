import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../player.entity.js';
import { PlayerNotFoundError } from '../player.errors.js';
import type { PlayerRepository } from '../player.repository.js';
import { GetMeService } from './get-me.service.js';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Alice',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function makeRepository(): PlayerRepository {
  return {
    findById: vi.fn(),
    findByName: vi.fn(),
    save: vi.fn(),
  };
}

describe('GetMeService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the authenticated player', async () => {
    const players = makeRepository();
    const player = makePlayer();
    vi.mocked(players.findById).mockResolvedValue(player);

    const result = await new GetMeService(players).execute(player.id);

    expect(players.findById).toHaveBeenCalledWith(player.id);
    expect(result).toEqual(player);
  });

  it('throws PlayerNotFoundError when the player does not exist', async () => {
    const players = makeRepository();
    vi.mocked(players.findById).mockResolvedValue(null);

    await expect(
      new GetMeService(players).execute('missing-id'),
    ).rejects.toBeInstanceOf(PlayerNotFoundError);
  });
});
