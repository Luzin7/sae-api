import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import authPlugin from '../../plugins/auth.plugin.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import authRoutes, { type AuthServices } from './auth.routes.js';
import type {
  AuthSessionRepository,
  CredentialsRepository,
} from './auth.repository.js';
import { LoginService } from './login/login.service.js';
import { LogoutService } from './logout/logout.service.js';
import { RefreshService } from './refresh/refresh.service.js';
import { RegisterService } from './register/register.service.js';
import { WsTokenService } from './ws-token/ws-token.service.js';

process.env.JWT_SECRET = 'test-secret-key-for-tests-only';

function makeCredentialsRepository(): CredentialsRepository {
  return {
    findByUsername: vi.fn(),
    create: vi.fn(),
  };
}

function makeSessionsRepository(): AuthSessionRepository {
  return {
    create: vi.fn(),
    findByHash: vi.fn(),
    deleteByHash: vi.fn(),
    deleteByPlayerId: vi.fn(),
  };
}

interface TestApp {
  app: FastifyInstance;
  credentials: CredentialsRepository;
  sessions: AuthSessionRepository;
}

async function buildTestApp(): Promise<TestApp> {
  const credentials = makeCredentialsRepository();
  const sessions = makeSessionsRepository();
  const sign = vi.fn().mockReturnValue('signed-token');
  const passwords = {
    hash: vi.fn().mockResolvedValue('password-hash'),
    verify: vi.fn().mockResolvedValue(true),
  };
  const refreshTokens = {
    generate: vi.fn().mockReturnValue('refresh-token'),
    hash: vi.fn((token: string) => `hash:${token}`),
  };

  const services: AuthServices = {
    register: new RegisterService(
      credentials,
      sessions,
      { sign },
      passwords,
      refreshTokens,
    ),
    login: new LoginService(
      credentials,
      sessions,
      { sign },
      passwords,
      refreshTokens,
    ),
    refresh: new RefreshService(sessions, { sign }, refreshTokens),
    logout: new LogoutService(sessions),
    wsToken: new WsTokenService({ sign }),
  };

  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  registerErrorHandler(app);
  await app.register(authRoutes, { services });

  return { app, credentials, sessions };
}

function setCookieHeader(headers: { 'set-cookie'?: string | string[] }): string {
  const header = headers['set-cookie'];
  if (!header) return '';
  if (Array.isArray(header)) return header.join(';');
  return header;
}

describe('POST /auth/register', () => {
  it('rejects a name shorter than 3 characters', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'ab', password: 'secret123' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'validname', password: 'short' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('creates the account, sets both cookies and returns the player', async () => {
    const { app, credentials } = await buildTestApp();
    vi.mocked(credentials.findByUsername).mockResolvedValue(null);
    vi.mocked(credentials.create).mockResolvedValue({
      id: 'player-1',
      name: 'Alice',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Alice', password: 'secret123' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      player: { id: 'player-1', name: 'Alice' },
    });

    const cookies = setCookieHeader(res.headers);
    expect(cookies).toContain('token=');
    expect(cookies).toContain('refresh_token=');
  });
});

describe('POST /auth/login', () => {
  it('rejects an empty body', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 with the generic error for unknown credentials', async () => {
    const { app, credentials } = await buildTestApp();
    vi.mocked(credentials.findByUsername).mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { name: 'nobody', password: 'secret123' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /auth/logout', () => {
  it('returns 401 without authentication', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({ method: 'POST', url: '/auth/logout' });

    expect(res.statusCode).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('returns 401 when the refresh cookie is absent', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({ method: 'POST', url: '/auth/refresh' });

    expect(res.statusCode).toBe(401);
  });

  it('rotates the session and sets fresh cookies', async () => {
    const { app, sessions } = await buildTestApp();
    vi.mocked(sessions.findByHash).mockResolvedValue({
      playerId: 'player-1',
      name: 'Alice',
      expiresAt: new Date(Date.now() + 100_000),
      lastUsedAt: null,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: 'old-token' },
    });

    expect(res.statusCode).toBe(200);
    const cookies = setCookieHeader(res.headers);
    expect(cookies).toContain('refresh_token=');
  });
});

describe('GET /auth/ws-token', () => {
  it('returns 401 without authentication', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/auth/ws-token' });

    expect(res.statusCode).toBe(401);
  });

  it('returns a short-lived scoped token instead of the session cookie', async () => {
    const { app } = await buildTestApp();
    const accessToken = app.jwt.sign({ sub: 'player-1', name: 'Alice' });

    const res = await app.inject({
      method: 'GET',
      url: '/auth/ws-token',
      cookies: { token: accessToken },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ token: 'signed-token' });
    expect(res.json().token).not.toBe(accessToken);
  });
});
