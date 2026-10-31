import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth.plugin.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';
import { CreateGameService } from './create-game/create-game.service.js';
import { DeleteGameService } from './delete-game/delete-game.service.js';
import type { Game } from './game.entity.js';
import { GameQueryService } from './game-query.service.js';
import type { GameRepository } from './game.repository.js';
import gameRoutes, { type GameServices } from './game.routes.js';
import { JoinGameService } from './join-game/join-game.service.js';
import { LeaveGameService } from './leave-game/leave-game.service.js';
import { UpdateGameService } from './update-game/update-game.service.js';

process.env.JWT_SECRET = 'test-secret-key-for-tests-only';

const PLAYER_ID = 'player-1';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    masterId: PLAYER_ID,
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

function makeServices(
  games: GameRepository,
  players: PlayerDirectory = makePlayers(),
): GameServices {
  return {
    createGame: new CreateGameService(games, { generate: () => 'CODE123' }),
    joinGame: new JoinGameService(games),
    updateGame: new UpdateGameService(games),
    deleteGame: new DeleteGameService(games),
    leaveGame: new LeaveGameService(games),
    query: new GameQueryService(games, players),
  };
}

async function buildTestApp(services: GameServices) {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  registerErrorHandler(app);
  await app.register(gameRoutes, { prefix: '/games', services });
  return app;
}

function makeToken(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  playerId = PLAYER_ID,
) {
  return app.jwt.sign({ sub: playerId, name: 'Tester' });
}

beforeEach(() => vi.clearAllMocks());

describe('game routes', () => {
  it('returns 401 without authentication', async () => {
    const app = await buildTestApp(makeServices(makeGames()));

    const res = await app.inject({ method: 'POST', url: '/games' });

    expect(res.statusCode).toBe(401);
  });

  it('creates a game for the authenticated master', async () => {
    const games = makeGames();
    vi.mocked(games.create).mockResolvedValue(makeGame());
    const app = await buildTestApp(makeServices(games));

    const res = await app.inject({
      method: 'POST',
      url: '/games',
      payload: { name: 'Mesa' },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().game.inviteCode).toBe('CODE123');
  });

  it('lists mastered and joined games with the full shape', async () => {
    const games = makeGames();
    vi.mocked(games.findMastered).mockResolvedValue([
      makeGame({ id: 'g1', name: 'Mesma' }),
    ]);
    vi.mocked(games.findJoined).mockResolvedValue([
      makeGame({ id: 'g2', name: 'Outra', inviteCode: 'OTHER1' }),
    ]);
    const app = await buildTestApp(makeServices(games));

    const res = await app.inject({
      method: 'GET',
      url: '/games/mine',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().games).toEqual([
      {
        id: 'g1',
        masterId: PLAYER_ID,
        name: 'Mesma',
        description: null,
        imageUrl: null,
        inviteCode: 'CODE123',
        isActive: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'g2',
        masterId: PLAYER_ID,
        name: 'Outra',
        description: null,
        imageUrl: null,
        inviteCode: 'OTHER1',
        isActive: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('returns 404 when joining with an unknown invite code', async () => {
    const games = makeGames();
    vi.mocked(games.findByInviteCode).mockResolvedValue(null);
    const app = await buildTestApp(makeServices(games));

    const res = await app.inject({
      method: 'POST',
      url: '/games/join',
      payload: { inviteCode: 'NOPE' },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when reading a game the player does not belong to', async () => {
    const games = makeGames();
    vi.mocked(games.findById).mockResolvedValue(
      makeGame({ masterId: 'other-master' }),
    );
    vi.mocked(games.isMember).mockResolvedValue(false);
    const app = await buildTestApp(makeServices(games));

    const res = await app.inject({
      method: 'GET',
      url: '/games/game-1',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns the master and players with their character ids', async () => {
    const games = makeGames();
    const players = makePlayers(
      { 'master-1': 'Mestre' },
      { 'player-1': ['char-old', 'char-new'] },
    );
    vi.mocked(games.findById).mockResolvedValue(
      makeGame({ masterId: 'master-1' }),
    );
    vi.mocked(games.isMember).mockResolvedValue(true);
    vi.mocked(games.findPlayers).mockResolvedValue([
      { id: 'player-1', name: 'Ana' },
      { id: 'player-2', name: 'Bia' },
      { id: 'master-1', name: 'Mestre' },
    ]);
    const app = await buildTestApp(makeServices(games, players));

    const res = await app.inject({
      method: 'GET',
      url: '/games/game-1/players',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      master: { id: 'master-1', name: 'Mestre' },
      players: [
        { id: 'player-1', name: 'Ana', characterIds: ['char-old', 'char-new'] },
        { id: 'player-2', name: 'Bia', characterIds: [] },
      ],
    });
  });

  it('returns 403 when a non-master updates a game', async () => {
    const games = makeGames();
    vi.mocked(games.findById).mockResolvedValue(
      makeGame({ masterId: 'other-master' }),
    );
    const app = await buildTestApp(makeServices(games));

    const res = await app.inject({
      method: 'PATCH',
      url: '/games/game-1',
      payload: { name: 'Novo' },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('deletes a game for the master', async () => {
    const games = makeGames();
    vi.mocked(games.findById).mockResolvedValue(makeGame());
    const app = await buildTestApp(makeServices(games));

    const res = await app.inject({
      method: 'DELETE',
      url: '/games/game-1',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(204);
    expect(games.delete).toHaveBeenCalledWith('game-1');
  });
});
