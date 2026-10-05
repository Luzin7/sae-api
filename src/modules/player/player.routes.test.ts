import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authPlugin from '../../plugins/auth.plugin.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import { GetMeService } from './get-me/get-me.service.js';
import { GetPlayerService } from './get-player/get-player.service.js';
import type { Player } from './player.entity.js';
import type { PlayerRepository } from './player.repository.js';
import playerRoutes, { type PlayerServices } from './player.routes.js';
import { UpdateMeService } from './update-me/update-me.service.js';

process.env.JWT_SECRET = 'test-secret-key-for-tests-only';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Tester',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makePlayerRepository(): PlayerRepository {
  return {
    findById: vi.fn(),
    findByName: vi.fn(),
    save: vi.fn(),
  };
}

function makeServices(players: PlayerRepository): PlayerServices {
  return {
    getMe: new GetMeService(players),
    getPlayer: new GetPlayerService(players),
    updateMe: new UpdateMeService(players),
  };
}

async function buildTestApp(services: PlayerServices) {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  registerErrorHandler(app);
  await app.register(playerRoutes, { prefix: '/players', services });
  return app;
}

function makeToken(app: Awaited<ReturnType<typeof buildTestApp>>): string {
  return app.jwt.sign({ sub: 'player-1', name: 'Tester' });
}

beforeEach(() => vi.clearAllMocks());

describe('player routes', () => {
  it('returns 401 without authentication', async () => {
    const app = await buildTestApp(makeServices(makePlayerRepository()));

    const res = await app.inject({ method: 'GET', url: '/players/me' });

    expect(res.statusCode).toBe(401);
  });

  it('wraps GET /players/me in a named player envelope', async () => {
    const players = makePlayerRepository();
    vi.mocked(players.findById).mockResolvedValue(makePlayer());
    const app = await buildTestApp(makeServices(players));

    const res = await app.inject({
      method: 'GET',
      url: '/players/me',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().player).toEqual({
      id: 'player-1',
      name: 'Tester',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('wraps GET /players/:id in a named player envelope', async () => {
    const players = makePlayerRepository();
    vi.mocked(players.findById).mockResolvedValue(makePlayer());
    const app = await buildTestApp(makeServices(players));

    const res = await app.inject({
      method: 'GET',
      url: '/players/player-1',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().player).toEqual({
      id: 'player-1',
      name: 'Tester',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('wraps PATCH /players/me in a named player envelope', async () => {
    const players = makePlayerRepository();
    vi.mocked(players.findById).mockResolvedValue(makePlayer());
    vi.mocked(players.findByName).mockResolvedValue(null);
    vi.mocked(players.save).mockResolvedValue(makePlayer({ name: 'Renamed' }));
    const app = await buildTestApp(makeServices(players));

    const res = await app.inject({
      method: 'PATCH',
      url: '/players/me',
      payload: { name: 'Renamed' },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().player.name).toBe('Renamed');
  });
});
