import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth.plugin.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import { EndSessionService } from './end-session/end-session.service.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { GetActiveService } from './get-active/get-active.service.js';
import { ListLogsService } from './list-logs/list-logs.service.js';
import type { GameSession } from './session.entity.js';
import type { SessionRepository } from './session.repository.js';
import sessionRoutes, { type SessionServices } from './session.routes.js';
import { StartSessionService } from './start-session/start-session.service.js';

process.env['JWT_SECRET'] = 'test-secret-key-for-tests-only';

const GAME_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_GAME_ID = '22222222-2222-2222-2222-222222222222';
const SESSION_ID = '33333333-3333-3333-3333-333333333333';
const PLAYER_ID = '44444444-4444-4444-4444-444444444444';

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: SESSION_ID,
    gameId: GAME_ID,
    isActive: true,
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
    endedAt: null,
    ...overrides,
  };
}

function makeSessions(): SessionRepository {
  return {
    create: vi.fn(),
    findActiveByGame: vi.fn(),
    findById: vi.fn(),
    end: vi.fn(),
    appendLog: vi.fn(),
    listLogs: vi.fn(),
  };
}

function makeAccess(): GameAccess {
  return { findById: vi.fn(), isMember: vi.fn() };
}

function makeServices(
  sessions: SessionRepository,
  access: GameAccess,
): SessionServices {
  return {
    startSession: new StartSessionService(sessions, access),
    endSession: new EndSessionService(sessions, access),
    getActive: new GetActiveService(sessions, access),
    listLogs: new ListLogsService(sessions, access),
  };
}

async function buildTestApp(services: SessionServices) {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  registerErrorHandler(app);
  await app.register(sessionRoutes, { prefix: '/games', services });
  return app;
}

function makeAuthToken(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  playerId = PLAYER_ID,
) {
  return app.jwt.sign({ sub: playerId, name: 'Tester' });
}

beforeEach(() => vi.clearAllMocks());

describe('session routes', () => {
  it('returns 401 when unauthenticated', async () => {
    const app = await buildTestApp(
      makeServices(makeSessions(), makeAccess()),
    );

    const res = await app.inject({
      method: 'POST',
      url: `/games/${GAME_ID}/session/start`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 201 when the master starts a session', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: GAME_ID,
      masterId: PLAYER_ID,
    });
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(null);
    vi.mocked(sessions.create).mockResolvedValue(makeSession());
    const app = await buildTestApp(makeServices(sessions, access));

    const res = await app.inject({
      method: 'POST',
      url: `/games/${GAME_ID}/session/start`,
      headers: { cookie: `token=${makeAuthToken(app)}` },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().session.id).toBe(SESSION_ID);
  });

  it('returns 409 when a session is already active', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: GAME_ID,
      masterId: PLAYER_ID,
    });
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(makeSession());
    const app = await buildTestApp(makeServices(sessions, access));

    const res = await app.inject({
      method: 'POST',
      url: `/games/${GAME_ID}/session/start`,
      headers: { cookie: `token=${makeAuthToken(app)}` },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('returns 403 when reading logs of a session from another game (IDOR)', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: GAME_ID,
      masterId: PLAYER_ID,
    });
    vi.mocked(sessions.findById).mockResolvedValue(
      makeSession({ gameId: OTHER_GAME_ID }),
    );
    const app = await buildTestApp(makeServices(sessions, access));

    const res = await app.inject({
      method: 'GET',
      url: `/games/${GAME_ID}/session/${SESSION_ID}/logs`,
      headers: { cookie: `token=${makeAuthToken(app)}` },
    });

    expect(res.statusCode).toBe(403);
    expect(sessions.listLogs).not.toHaveBeenCalled();
  });

  it('returns 204 when there is no active session', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: GAME_ID,
      masterId: PLAYER_ID,
    });
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(null);
    const app = await buildTestApp(makeServices(sessions, access));

    const res = await app.inject({
      method: 'GET',
      url: `/games/${GAME_ID}/session/active`,
      headers: { cookie: `token=${makeAuthToken(app)}` },
    });

    expect(res.statusCode).toBe(204);
  });
});
