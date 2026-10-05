import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../game.entity.js';
import type { GameRepository } from '../game.repository.js';
import { CreateGameService } from './create-game.service.js';

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

describe('CreateGameService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates an invite code and persists the game', async () => {
    const games = makeGames();
    vi.mocked(games.create).mockResolvedValue(makeGame());

    const result = await new CreateGameService(games, {
      generate: () => 'CODE123',
    }).execute('master-1', { name: 'Mesa' });

    expect(games.create).toHaveBeenCalledWith('master-1', {
      name: 'Mesa',
      inviteCode: 'CODE123',
    });
    expect(result.inviteCode).toBe('CODE123');
  });

  it('forwards optional description and imageUrl', async () => {
    const games = makeGames();
    vi.mocked(games.create).mockResolvedValue(makeGame());

    await new CreateGameService(games, {
      generate: () => 'CODE123',
    }).execute('master-1', {
      name: 'Mesa',
      description: 'Uma campanha',
      imageUrl: 'https://example.com/art.png',
    });

    expect(games.create).toHaveBeenCalledWith('master-1', {
      name: 'Mesa',
      description: 'Uma campanha',
      imageUrl: 'https://example.com/art.png',
      inviteCode: 'CODE123',
    });
  });
});
