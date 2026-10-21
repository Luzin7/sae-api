import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';
import type { Game } from './game.entity.js';
import { GameNotFoundError } from './game.errors.js';
import type { GameRepository } from './game.repository.js';
import { GameQueryService } from './game-query.service.js';

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

function makePlayers(
  names: Record<string, string> = {},
  characters: Record<string, string[]> = {},
): PlayerDirectory {
  return {
    findById: vi.fn(async (playerId: string) => {
      const name = names[playerId];
      if (name === undefined) return null;

      return { id: playerId, name };
    }),
    findCharactersByGame: vi.fn(
      async () => new Map(Object.entries(characters)),
    ),
  };
}

describe('GameQueryService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('merges mastered and joined games, deduplicating ids', async () => {
    const games = makeGames();
    vi.mocked(games.findMastered).mockResolvedValue([
      makeGame({ id: 'g1', name: 'Mesma' }),
    ]);
    vi.mocked(games.findJoined).mockResolvedValue([
      makeGame({ id: 'g1', name: 'Mesma' }),
      makeGame({ id: 'g2', name: 'Outra' }),
    ]);

    const result = await new GameQueryService(games, makePlayers()).getMine(
      'player-1',
      {
        limit: 10,
        offset: 5,
      },
    );

    expect(games.findJoined).toHaveBeenCalledWith('player-1', {
      limit: 10,
      offset: 5,
    });
    expect(result.map((game) => game.id)).toEqual(['g1', 'g2']);
  });

  it('uses the default page for getMine', async () => {
    const games = makeGames();
    vi.mocked(games.findMastered).mockResolvedValue([]);
    vi.mocked(games.findJoined).mockResolvedValue([]);

    await new GameQueryService(games, makePlayers()).getMine('player-1');

    expect(games.findJoined).toHaveBeenCalledWith('player-1', {
      limit: 20,
      offset: 0,
    });
  });

  it('returns the game for a member and forbids an outsider', async () => {
    const games = makeGames();
    vi.mocked(games.findById).mockResolvedValue(makeGame());
    vi.mocked(games.isMember).mockResolvedValue(true);

    const game = await new GameQueryService(games, makePlayers()).getGame(
      'game-1',
      'player-1',
    );
    expect(game.id).toBe('game-1');

    vi.mocked(games.isMember).mockResolvedValue(false);
    await expect(
      new GameQueryService(games, makePlayers()).getGame('game-1', 'outsider'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws GameNotFoundError when the game is absent', async () => {
    const games = makeGames();
    vi.mocked(games.findById).mockResolvedValue(null);

    await expect(
      new GameQueryService(games, makePlayers()).getPlayers(
        'game-1',
        'player-1',
      ),
    ).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('returns the master plus players with their character ids', async () => {
    const games = makeGames();
    const players = makePlayers({ 'master-1': 'Mestre' }, { p1: ['char-1'] });
    vi.mocked(games.findById).mockResolvedValue(makeGame());
    vi.mocked(games.isMember).mockResolvedValue(true);
    vi.mocked(games.findPlayers).mockResolvedValue([
      { id: 'p1', name: 'Ana' },
      { id: 'p2', name: 'Bia' },
      { id: 'master-1', name: 'Mestre' },
    ]);

    const roster = await new GameQueryService(games, players).getPlayers(
      'game-1',
      'player-1',
    );

    expect(roster).toEqual({
      master: { id: 'master-1', name: 'Mestre' },
      players: [
        { id: 'p1', name: 'Ana', characterIds: ['char-1'] },
        { id: 'p2', name: 'Bia', characterIds: [] },
      ],
    });
    expect(players.findCharactersByGame).toHaveBeenCalledTimes(1);
    expect(players.findCharactersByGame).toHaveBeenCalledWith('game-1');
  });

  it('returns every character id of a player in the directory order', async () => {
    const games = makeGames();
    const players = makePlayers(
      { 'master-1': 'Mestre' },
      { p1: ['char-old', 'char-new'] },
    );
    vi.mocked(games.findById).mockResolvedValue(makeGame());
    vi.mocked(games.isMember).mockResolvedValue(true);
    vi.mocked(games.findPlayers).mockResolvedValue([
      { id: 'p1', name: 'Ana' },
      { id: 'master-1', name: 'Mestre' },
    ]);

    const roster = await new GameQueryService(games, players).getPlayers(
      'game-1',
      'player-1',
    );

    expect(roster.players).toEqual([
      { id: 'p1', name: 'Ana', characterIds: ['char-old', 'char-new'] },
    ]);
  });

  it('resolves the master from masterId when they are not in player_game', async () => {
    const games = makeGames();
    const players = makePlayers({ 'master-1': 'Mestre' });
    vi.mocked(games.findById).mockResolvedValue(makeGame());
    vi.mocked(games.isMember).mockResolvedValue(true);
    vi.mocked(games.findPlayers).mockResolvedValue([{ id: 'p1', name: 'Ana' }]);

    const roster = await new GameQueryService(games, players).getPlayers(
      'game-1',
      'player-1',
    );

    expect(roster.master).toEqual({ id: 'master-1', name: 'Mestre' });
  });
});
