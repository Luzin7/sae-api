import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { Game } from '../game.entity.js';
import { GameNotFoundError } from '../game.errors.js';
import type { GameRepository } from '../game.repository.js';
import { DeleteGameService } from './delete-game.service.js';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    masterId: 'master-1',
    name: 'Mesa',
    description: null,
    imageUrl: null,
    inviteCode: 'CODE123',
    isActive: false,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeGames(): GameRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByInviteCode: vi.fn(),
    findMastered: vi.fn(),
    findJoined: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addPlayer: vi.fn(),
    removePlayer: vi.fn(),
    findPlayers: vi.fn(),
    isMember: vi.fn(),
  };
}

describe('DeleteGameService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws GameNotFoundError when the game is absent', async () => {
    const games = makeGames();
    vi.mocked(games.findById).mockResolvedValue(null);

    await expect(
      new DeleteGameService(games).execute('game-1', 'master-1'),
    ).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('throws ForbiddenError when the requester is not the master', async () => {
    const games = makeGames();
    vi.mocked(games.findById).mockResolvedValue(makeGame());

    await expect(
      new DeleteGameService(games).execute('game-1', 'outsider'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(games.delete).not.toHaveBeenCalled();
  });

  it('deletes the game for the master', async () => {
    const games = makeGames();
    vi.mocked(games.findById).mockResolvedValue(makeGame());

    await new DeleteGameService(games).execute('game-1', 'master-1');

    expect(games.delete).toHaveBeenCalledWith('game-1');
  });
});
