import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../player.entity.js';
import {
  PlayerNameTakenError,
  PlayerNotFoundError,
} from '../player.errors.js';
import type { PlayerRepository } from '../player.repository.js';
import { UpdateMeService } from './update-me.service.js';

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

describe('UpdateMeService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws PlayerNotFoundError when the player does not exist', async () => {
    const players = makeRepository();
    vi.mocked(players.findById).mockResolvedValue(null);

    await expect(
      new UpdateMeService(players).execute('missing-id', { name: 'NewName' }),
    ).rejects.toBeInstanceOf(PlayerNotFoundError);
  });

  it('throws PlayerNameTakenError when the new name is in use', async () => {
    const players = makeRepository();
    vi.mocked(players.findById).mockResolvedValue(makePlayer());
    vi.mocked(players.findByName).mockResolvedValue(
      makePlayer({ id: 'player-2', name: 'Taken' }),
    );

    await expect(
      new UpdateMeService(players).execute('player-1', { name: 'Taken' }),
    ).rejects.toBeInstanceOf(PlayerNameTakenError);
  });

  it('saves the player when the name is free', async () => {
    const players = makeRepository();
    const player = makePlayer();
    const updated = makePlayer({ name: 'NewName' });
    vi.mocked(players.findById).mockResolvedValue(player);
    vi.mocked(players.findByName).mockResolvedValue(null);
    vi.mocked(players.save).mockResolvedValue(updated);

    const result = await new UpdateMeService(players).execute(player.id, {
      name: 'NewName',
    });

    expect(players.save).toHaveBeenCalledWith(player.id, { name: 'NewName' });
    expect(result).toEqual(updated);
  });

  it('skips the uniqueness check when the name is unchanged', async () => {
    const players = makeRepository();
    const player = makePlayer();
    vi.mocked(players.findById).mockResolvedValue(player);
    vi.mocked(players.save).mockResolvedValue(player);

    await new UpdateMeService(players).execute(player.id, {
      name: player.name,
    });

    expect(players.findByName).not.toHaveBeenCalled();
  });
});
