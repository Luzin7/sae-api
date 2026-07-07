import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth.plugin.js';
import errorHandlerPlugin from '../../plugins/error-handler.plugin.js';
import sessionRoutes from './session.routes.js';

process.env['JWT_SECRET'] = 'test-secret-key-for-tests-only';

const mockDbSession = {
  findFirst: vi.fn(),
};

const mockDbGame = {
  findFirst: vi.fn(),
};

const mockDbPlayerGame = {
  findFirst: vi.fn(),
};

vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      session: { findFirst: (...args: unknown[]) => mockDbSession.findFirst(...args) },
      game: { findFirst: (...args: unknown[]) => mockDbGame.findFirst(...args) },
      playerGame: { findFirst: (...args: unknown[]) => mockDbPlayerGame.findFirst(...args) },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 's1', gameId: 'g1', isActive: true, startedAt: new Date(), endedAt: null }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 's1', gameId: 'g1', isActive: false, startedAt: new Date(), endedAt: new Date() }])),
        })),
      })),
    })),
  },
}));

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(sessionRoutes, { prefix: '/games' });
  return app;
}

function makeAuthToken(app: Awaited<ReturnType<typeof buildTestApp>>, playerId = 'master-1') {
  return app.jwt.sign({ sub: playerId, name: 'Master' });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /games/:gameId/session/start', () => {
  it('returns 401 when not authenticated', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'POST', url: '/games/g1/session/start' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when game does not exist', async () => {
    const app = await buildTestApp();
    mockDbGame.findFirst.mockResolvedValue(null);
    const token = makeAuthToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/games/g1/session/start',
      headers: { cookie: `token=${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when requester is not the master', async () => {
    const app = await buildTestApp();
    mockDbGame.findFirst.mockResolvedValue({ id: 'g1', masterId: 'another-master' });
    const token = makeAuthToken(app, 'not-master');
    const res = await app.inject({
      method: 'POST',
      url: '/games/g1/session/start',
      headers: { cookie: `token=${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 409 when a session is already active', async () => {
    const app = await buildTestApp();
    mockDbGame.findFirst.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
    mockDbSession.findFirst.mockResolvedValue({ id: 's1', isActive: true });
    const token = makeAuthToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/games/g1/session/start',
      headers: { cookie: `token=${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 201 when master starts a new session', async () => {
    const app = await buildTestApp();
    mockDbGame.findFirst.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
    mockDbSession.findFirst.mockResolvedValue(null);
    const token = makeAuthToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/games/g1/session/start',
      headers: { cookie: `token=${token}` },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('POST /games/:gameId/session/end', () => {
  it('returns 404 when no active session exists', async () => {
    const app = await buildTestApp();
    mockDbGame.findFirst.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
    mockDbSession.findFirst.mockResolvedValue(null);
    const token = makeAuthToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/games/g1/session/end',
      headers: { cookie: `token=${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 when master ends the active session', async () => {
    const app = await buildTestApp();
    mockDbGame.findFirst.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
    mockDbSession.findFirst.mockResolvedValue({ id: 's1', isActive: true });
    const token = makeAuthToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/games/g1/session/end',
      headers: { cookie: `token=${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().isActive).toBe(false);
  });
});

describe('GET /games/:gameId/session/active', () => {
  it('returns 403 when player is not in the game', async () => {
    const app = await buildTestApp();
    mockDbGame.findFirst.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
    mockDbPlayerGame.findFirst.mockResolvedValue(undefined);
    const token = makeAuthToken(app, 'outsider');
    const res = await app.inject({
      method: 'GET',
      url: '/games/g1/session/active',
      headers: { cookie: `token=${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 204 when there is no active session', async () => {
    const app = await buildTestApp();
    mockDbGame.findFirst.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
    mockDbSession.findFirst.mockResolvedValue(null);
    const token = makeAuthToken(app);
    const res = await app.inject({
      method: 'GET',
      url: '/games/g1/session/active',
      headers: { cookie: `token=${token}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it('returns 200 with the active session for the master', async () => {
    const app = await buildTestApp();
    mockDbGame.findFirst.mockResolvedValue({ id: 'g1', masterId: 'master-1' });
    mockDbSession.findFirst.mockResolvedValue({ id: 's1', gameId: 'g1', isActive: true });
    const token = makeAuthToken(app);
    const res = await app.inject({
      method: 'GET',
      url: '/games/g1/session/active',
      headers: { cookie: `token=${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('s1');
  });
});
