import type { FastifyInstance } from 'fastify';
import { db } from '../../db/index.js';
import { player, refreshToken } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { AuthService } from './auth.service.js';
import { authenticate } from '../../middleware/authenticate.js';
import { hashPassword, verifyPassword } from '../../lib/hash.js';
import { LoginBodySchema, RefreshBodySchema, RegisterBodySchema } from './auth.schemas.js';

function buildAuthService(app: FastifyInstance): AuthService {
  return new AuthService(
    {
      findByName: async (name) =>
        (await db.query.player.findFirst({ where: eq(player.name, name) })) ?? null,
      create: async (data) => {
        const [created] = await db.insert(player).values(data).returning();
        return created!;
      },
    },
    {
      create: async (data) => {
        const [created] = await db.insert(refreshToken).values(data).returning();
        return created!;
      },
      findByToken: async (token) =>
        (await db.query.refreshToken.findFirst({
          where: eq(refreshToken.token, token),
          with: { player: true },
        })) ?? null,
      deleteByToken: async (token) => {
        await db.delete(refreshToken).where(eq(refreshToken.token, token));
      },
      deleteByPlayerId: async (playerId) => {
        await db.delete(refreshToken).where(eq(refreshToken.playerId, playerId));
      },
    },
    { hashPassword, verifyPassword },
    { sign: (payload) => app.jwt.sign(payload) },
  );
}

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    '/auth/register',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = RegisterBodySchema.parse(request.body);
      const authService = buildAuthService(app);
      const result = await authService.register(body);

      reply
        .setCookie('token', result.accessToken, { httpOnly: true, path: '/', sameSite: 'lax' })
        .status(201)
        .send({ player: { id: result.player.id, name: result.player.name } });
    },
  );

  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = LoginBodySchema.parse(request.body);
      const authService = buildAuthService(app);
      const result = await authService.login(body);

      reply
        .setCookie('token', result.accessToken, { httpOnly: true, path: '/', sameSite: 'lax' })
        .send({ player: { id: result.player.id, name: result.player.name } });
    },
  );

  app.post(
    '/auth/logout',
    { preHandler: authenticate },
    async (request, reply) => {
      const authService = buildAuthService(app);
      await authService.logout(request.playerId);
      reply.clearCookie('token').send({ ok: true });
    },
  );

  app.post(
    '/auth/refresh',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
    const { refreshToken: token } = RefreshBodySchema.parse(request.body);
    const authService = buildAuthService(app);
    const result = await authService.refresh(token);

    reply
      .setCookie('token', result.accessToken, { httpOnly: true, path: '/', sameSite: 'lax' })
      .send({ ok: true });
  });

  app.get('/auth/ws-token', { preHandler: authenticate }, async (request) => {
    return { token: request.cookies['token'] ?? '' };
  });
}
