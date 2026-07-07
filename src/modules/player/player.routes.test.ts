import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth.plugin.js';
import errorHandlerPlugin from '../../plugins/error-handler.plugin.js';
import playerRoutes from './player.routes.js';

vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      player: { findFirst: vi.fn() },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => []) })) })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(() => []) })),
        })),
      })),
    })),
  },
}));

process.env['JWT_SECRET'] = 'test-secret-key-for-tests-only';

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(playerRoutes, { prefix: '/players' });
  return app;
}

function makeToken(app: Awaited<ReturnType<typeof buildTestApp>>, playerId = 'test-player-id') {
  return app.jwt.sign({ sub: playerId, name: 'testplayer' });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /players/me', () => {
  it('returns 401 without authentication', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/players/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const { db } = await import('../../db/index.js');
    vi.mocked(db.query.player.findFirst).mockResolvedValue({
      id: 'test-player-id',
      name: 'testplayer',
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const app = await buildTestApp();
    const token = makeToken(app);

    const res = await app.inject({
      method: 'GET',
      url: '/players/me',
      cookies: { token },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /players/:id', () => {
  it('returns 401 without authentication', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/players/some-id' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 when requesting own profile', async () => {
    const { db } = await import('../../db/index.js');
    vi.mocked(db.query.player.findFirst).mockResolvedValue({
      id: 'test-player-id',
      name: 'testplayer',
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const app = await buildTestApp();
    const token = makeToken(app, 'test-player-id');

    const res = await app.inject({
      method: 'GET',
      url: '/players/test-player-id',
      cookies: { token },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 403 when requesting profile of a player with no shared game', async () => {
    const { db } = await import('../../db/index.js');
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(() => []) })),
        })),
      })),
    } as never);

    const app = await buildTestApp();
    const token = makeToken(app, 'requester-id');

    const res = await app.inject({
      method: 'GET',
      url: '/players/other-player-id',
      cookies: { token },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /players/me', () => {
  it('returns 401 without authentication', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/players/me',
      payload: { name: 'newname' },
    });
    expect(res.statusCode).toBe(401);
  });
});
