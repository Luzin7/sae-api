import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../game.entity.js';
import { AlreadyMemberError, InviteCodeNotFoundError } from '../game.errors.js';
import type { GameRepository } from '../game.repository.js';
import { JoinGameService } from './join-game.service.js';

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

describe('JoinGameService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws InviteCodeNotFoundError when the code is unknown', async () => {
    const games = makeGames();
    vi.mocked(games.findByInviteCode).mockResolvedValue(null);

    await expect(
      new JoinGameService(games).execute('NOPE', 'player-1'),
    ).rejects.toBeInstanceOf(InviteCodeNotFoundError);
  });

  it('throws AlreadyMemberError when the player already belongs', async () => {
    const games = makeGames();
    vi.mocked(games.findByInviteCode).mockResolvedValue(makeGame());
    vi.mocked(games.isMember).mockResolvedValue(true);

    await expect(
      new JoinGameService(games).execute('CODE123', 'player-1'),
    ).rejects.toBeInstanceOf(AlreadyMemberError);
    expect(games.addPlayer).not.toHaveBeenCalled();
  });

  it('adds the player and returns the full game', async () => {
    const games = makeGames();
    vi.mocked(games.findByInviteCode).mockResolvedValue(makeGame());
    vi.mocked(games.isMember).mockResolvedValue(false);

    const result = await new JoinGameService(games).execute(
      'CODE123',
      'player-1',
    );

    expect(games.addPlayer).toHaveBeenCalledWith('game-1', 'player-1');
    expect(result.id).toBe('game-1');
    expect(result.inviteCode).toBe('CODE123');
  });
});
