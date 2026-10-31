import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationEnabled } from '@test/integration-env.js';
import { createSeed } from '@test/integration-db.js';
import { db } from '@infra/db/index.js';
import { authSession, player } from '@infra/db/schema.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import authPlugin from '../../../plugins/auth.plugin.js';
import { hash, verify } from '../../../lib/hash.js';
import authRoutes, { type AuthServices } from '@modules/auth/auth.routes.js';
import { LoginService } from '@modules/auth/login/login.service.js';
import { LogoutService } from '@modules/auth/logout/logout.service.js';
import {
  REFRESH_GRACE_WINDOW_MS,
  RefreshService,
} from '@modules/auth/refresh/refresh.service.js';
import { RegisterService } from '@modules/auth/register/register.service.js';
import { WsTokenService } from '@modules/auth/ws-token/ws-token.service.js';
import {
  authSessionRepository,
  credentialsRepository,
} from './auth.repository.js';

process.env.JWT_SECRET = 'integration-secret';

const { cleanupSeed } = createSeed('auth-refresh');

const refreshTokens = {
  generate: () => randomBytes(32).toString('hex'),
  hash: (token: string) => createHash('sha256').update(token).digest('hex'),
};

async function buildApp(): Promise<FastifyInstance> {
  const credentials = credentialsRepository();
  const sessions = authSessionRepository();
  const signing = {
    sign: (payload: object, options?: { expiresIn?: string | number }) =>
      app.jwt.sign(payload as { sub: string; name: string }, options),
  };
  const passwords = { hash, verify };
  const services: AuthServices = {
    register: new RegisterService(
      credentials,
      sessions,
      signing,
      passwords,
      refreshTokens,
    ),
    login: new LoginService(
      credentials,
      sessions,
      signing,
      passwords,
      refreshTokens,
    ),
    refresh: new RefreshService(sessions, signing, refreshTokens, {
      warn: () => {},
    }),
    logout: new LogoutService(sessions),
    wsToken: new WsTokenService(signing),
  };
  const app = Fastify({ logger: false });
  await app.register(rateLimit, { allowList: () => true });
  await app.register(authPlugin);
  registerErrorHandler(app);
  await app.register(authRoutes, { services });

  return app;
}

function cookieValue(
  res: { cookies: { name: string; value: string }[] },
  name: string,
): string {
  return res.cookies.find((cookie) => cookie.name === name)?.value ?? '';
}

describe.skipIf(!integrationEnabled)('refresh token rotation (real DB)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await cleanupSeed();
    await app.close();
  });

  async function register() {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: `verify-auth-refresh-${randomUUID()}`,
        password: 'secret123',
      },
    });
    expect(res.statusCode).toBe(201);

    return {
      refreshToken: cookieValue(res, 'refresh_token'),
      accessToken: cookieValue(res, 'token'),
    };
  }

  function refresh(refreshToken: string) {
    return app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: refreshToken },
    });
  }

  async function rowOf(token: string) {
    const [row] = await db
      .select()
      .from(authSession)
      .where(eq(authSession.tokenHash, refreshTokens.hash(token)));
    if (!row) throw new Error('session row missing');

    return row;
  }

  async function ageUse(token: string, ms: number): Promise<void> {
    await db
      .update(authSession)
      .set({ usedAt: new Date(Date.now() - ms) })
      .where(eq(authSession.tokenHash, refreshTokens.hash(token)));
  }

  it('rotation returns a new token in the same family and marks the old one used', async () => {
    const { refreshToken } = await register();

    const res = await refresh(refreshToken);

    const next = cookieValue(res, 'refresh_token');
    expect(res.statusCode).toBe(200);
    expect(next).not.toBe(refreshToken);
    const oldRow = await rowOf(refreshToken);
    const newRow = await rowOf(next);
    expect(oldRow.usedAt).not.toBeNull();
    expect(oldRow.replacedById).toBe(newRow.id);
    expect(newRow.familyId).toBe(oldRow.familyId);
    expect(newRow.usedAt).toBeNull();
  });

  it('two parallel refreshes inside the grace window both succeed and the session survives', async () => {
    const { refreshToken } = await register();

    const [first, second] = await Promise.all([
      refresh(refreshToken),
      refresh(refreshToken),
    ]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const tokens = [first, second].map((res) =>
      cookieValue(res, 'refresh_token'),
    );
    expect(tokens[0]).not.toBe(tokens[1]);
    for (const token of tokens) {
      expect((await refresh(token)).statusCode).toBe(200);
    }
  });

  it('reuse after the grace window revokes the family and the latest token stops working', async () => {
    const { refreshToken } = await register();
    const latest = cookieValue(await refresh(refreshToken), 'refresh_token');
    await ageUse(refreshToken, REFRESH_GRACE_WINDOW_MS + 1_000);

    const replay = await refresh(refreshToken);
    const afterReplay = await refresh(latest);

    expect(replay.statusCode).toBe(401);
    expect(afterReplay.statusCode).toBe(401);
    expect((await rowOf(latest)).revokedAt).not.toBeNull();
  });

  it('a replay after the window racing a legitimate rotation leaves no live token in the family', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { refreshToken } = await register();
      const latest = cookieValue(await refresh(refreshToken), 'refresh_token');
      await ageUse(refreshToken, REFRESH_GRACE_WINDOW_MS + 1_000);
      const { familyId } = await rowOf(latest);

      const [replay, legit] = await Promise.all([
        refresh(refreshToken),
        refresh(latest),
      ]);

      expect(replay.statusCode).toBe(401);
      const family = await db
        .select({ revokedAt: authSession.revokedAt })
        .from(authSession)
        .where(eq(authSession.familyId, familyId));
      expect(family.filter((row) => row.revokedAt === null)).toHaveLength(0);
      const successor = cookieValue(legit, 'refresh_token');
      if (successor) expect((await refresh(successor)).statusCode).toBe(401);
    }
  });

  it('logout revokes the session so the refresh token is rejected', async () => {
    const { refreshToken, accessToken } = await register();

    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { token: accessToken },
    });

    expect(logout.statusCode).toBe(200);
    expect((await refresh(refreshToken)).statusCode).toBe(401);
  });

  it('rejects an expired token', async () => {
    const { refreshToken } = await register();
    await db
      .update(authSession)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(authSession.tokenHash, refreshTokens.hash(refreshToken)));

    expect((await refresh(refreshToken)).statusCode).toBe(401);
  });

  it('rejects an unknown token', async () => {
    expect((await refresh(randomUUID())).statusCode).toBe(401);
  });

  it('a session created before the migration keeps working as a family root', async () => {
    const { refreshToken } = await register();
    const legacyToken = refreshTokens.generate();
    const row = await rowOf(refreshToken);
    await db.execute(sql`
      INSERT INTO auth_session (player_id, token_hash, expires_at)
      VALUES (${row.playerId}, ${refreshTokens.hash(legacyToken)}, now() + interval '1 day')
    `);

    const res = await refresh(legacyToken);

    expect(res.statusCode).toBe(200);
    expect((await rowOf(legacyToken)).familyId).not.toBe(row.familyId);
  });

  it('pruning on rotation removes only expired rows of the same player', async () => {
    const { refreshToken } = await register();
    const row = await rowOf(refreshToken);
    const staleToken = refreshTokens.generate();
    await db.insert(authSession).values({
      playerId: row.playerId,
      tokenHash: refreshTokens.hash(staleToken),
      expiresAt: new Date(Date.now() - 1_000),
    });

    await refresh(refreshToken);

    const remaining = await db
      .select({ id: authSession.id })
      .from(authSession)
      .where(eq(authSession.playerId, row.playerId));
    expect(remaining).toHaveLength(2);
    expect(
      await db.select().from(player).where(eq(player.id, row.playerId)),
    ).toHaveLength(1);
  });

  it('migration 0011 can run twice without error', async () => {
    const statements = readFileSync(
      new URL('../migrations/0011_refresh_token_families.sql', import.meta.url),
      'utf8',
    ).split('--> statement-breakpoint');

    await db.transaction(async (tx) => {
      for (const statement of [...statements, ...statements]) {
        await tx.execute(sql.raw(statement));
      }
    });
  });
});
