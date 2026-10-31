import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authPlugin from '../../plugins/auth.plugin.js';
import rateLimitPlugin from '../../plugins/rate-limit.plugin.js';
import { parseTrustProxy } from '@infra/http/trust-proxy.js';
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
    rotate: vi.fn(),
    deleteByPlayerId: vi.fn(),
  };
}

interface TestApp {
  app: FastifyInstance;
  credentials: CredentialsRepository;
  sessions: AuthSessionRepository;
}

async function buildTestApp(trustProxy?: string): Promise<TestApp> {
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
    refresh: new RefreshService(sessions, { sign }, refreshTokens, {
      warn: vi.fn(),
    }),
    logout: new LogoutService(sessions),
    wsToken: new WsTokenService({ sign }),
  };

  const app = Fastify({
    logger: false,
    trustProxy: parseTrustProxy(trustProxy),
  });
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);
  registerErrorHandler(app);
  await app.register(authRoutes, { services });

  return { app, credentials, sessions };
}

function setCookieHeader(headers: {
  'set-cookie'?: string | string[];
}): string {
  const header = headers['set-cookie'];
  if (!header) return '';
  if (Array.isArray(header)) return header.join(';');
  return header;
}

describe('POST /auth/register', () => {
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
    vi.mocked(sessions.rotate).mockResolvedValue({
      status: 'issued',
      playerId: 'player-1',
      name: 'Alice',
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

describe('auth cookie attributes', () => {
  const SEVEN_DAYS_SECONDS = '604800';

  function parseCookie(
    headers: { 'set-cookie'?: string | string[] },
    name: string,
  ): Map<string, string> {
    const header = headers['set-cookie'] ?? [];
    const lines = Array.isArray(header) ? header : [header];
    const line = lines.find((entry) => entry.startsWith(`${name}=`)) ?? '';
    const attributes = new Map<string, string>();
    for (const part of line.split(';').slice(1)) {
      const [key = '', value = ''] = part.trim().split('=');
      attributes.set(key.toLowerCase(), value);
    }

    return attributes;
  }

  async function login() {
    const { app, credentials } = await buildTestApp();
    vi.mocked(credentials.findByUsername).mockResolvedValue({
      id: 'player-1',
      name: 'Alice',
      passwordHash: 'password-hash',
    });

    return app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { name: 'Alice', password: 'secret123' },
    });
  }

  async function refresh() {
    const { app, sessions } = await buildTestApp();
    vi.mocked(sessions.rotate).mockResolvedValue({
      status: 'issued',
      playerId: 'player-1',
      name: 'Alice',
    });

    return app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: 'old-token' },
    });
  }

  async function logout() {
    const { app } = await buildTestApp();

    return app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { token: app.jwt.sign({ sub: 'player-1', name: 'Alice' }) },
    });
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['login', login],
    ['refresh', refresh],
  ])('%s sets exact cookie attributes in development', async (_, call) => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = await call();

    const access = parseCookie(res.headers, 'token');
    const refreshCookie = parseCookie(res.headers, 'refresh_token');
    for (const attributes of [access, refreshCookie]) {
      expect(attributes.has('httponly')).toBe(true);
      expect(attributes.has('secure')).toBe(false);
      expect(attributes.get('samesite')).toBe('Lax');
      expect(attributes.get('path')).toBe('/');
    }
    expect(access.has('max-age')).toBe(false);
    expect(refreshCookie.get('max-age')).toBe(SEVEN_DAYS_SECONDS);
  });

  it.each([
    ['login', login],
    ['refresh', refresh],
  ])('%s sets exact cookie attributes in production', async (_, call) => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await call();

    const access = parseCookie(res.headers, 'token');
    const refreshCookie = parseCookie(res.headers, 'refresh_token');
    for (const attributes of [access, refreshCookie]) {
      expect(attributes.has('httponly')).toBe(true);
      expect(attributes.has('secure')).toBe(true);
      expect(attributes.get('samesite')).toBe('None');
      expect(attributes.get('path')).toBe('/');
    }
    expect(access.has('max-age')).toBe(false);
    expect(refreshCookie.get('max-age')).toBe(SEVEN_DAYS_SECONDS);
  });

  it.each([
    ['development', false, 'Lax'],
    ['production', true, 'None'],
  ])(
    'logout clears both cookies with the %s attributes',
    async (env, secure, sameSite) => {
      vi.stubEnv('NODE_ENV', env);
      const res = await logout();

      expect(res.statusCode).toBe(200);
      for (const name of ['token', 'refresh_token']) {
        const attributes = parseCookie(res.headers, name);
        expect(attributes.has('httponly')).toBe(true);
        expect(attributes.has('secure')).toBe(secure);
        expect(attributes.get('samesite')).toBe(sameSite);
        expect(attributes.get('path')).toBe('/');
        expect(attributes.get('max-age')).toBe('0');
        expect(attributes.get('expires')).toBe('Thu, 01 Jan 1970 00:00:00 GMT');
      }
    },
  );
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

describe('POST /auth/login per-account rate limit', () => {
  const REAL_CLIENT = '203.0.113.7';

  function loginAs(app: FastifyInstance, name: string, attempt: number) {
    return app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'x-forwarded-for': `fake-${attempt}, ${REAL_CLIENT}` },
      payload: { name, password: 'wrong-password' },
    });
  }

  it('blocks the 11th attempt for the same name despite a forged IP', async () => {
    const { app } = await buildTestApp('2');
    for (let attempt = 1; attempt <= 10; attempt++) {
      const res = await loginAs(app, 'Victim', attempt);
      expect(res.statusCode).toBe(401);
    }

    const blocked = await loginAs(app, ' victim ', 11);

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
  });

  it('does not affect a different name', async () => {
    const { app } = await buildTestApp('2');
    for (let attempt = 1; attempt <= 11; attempt++) {
      await loginAs(app, 'victim', attempt);
    }

    const other = await loginAs(app, 'someone-else', 12);

    expect(other.statusCode).toBe(401);
  });
});
