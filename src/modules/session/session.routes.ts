import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { SessionService } from './session.service.js';
import { db } from '../../db/index.js';
import { session, sessionLog, game, playerGame } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

function buildSessionService(): SessionService {
  return new SessionService(
    {
      create: async (gameId) => {
        const [created] = await db.insert(session).values({ gameId }).returning();
        return created!;
      },
      findActiveByGameId: async (gameId) =>
        (await db.query.session.findFirst({
          where: and(eq(session.gameId, gameId), eq(session.isActive, true)),
        })) ?? null,
      endSession: async (sessionId) => {
        const [updated] = await db
          .update(session)
          .set({ isActive: false, endedAt: new Date() })
          .where(eq(session.id, sessionId))
          .returning();
        return updated!;
      },
      findLogsBySessionId: async (sessionId) =>
        db
          .select()
          .from(sessionLog)
          .where(eq(sessionLog.sessionId, sessionId))
          .orderBy(desc(sessionLog.createdAt)),
    },
    {
      findById: async (id) =>
        (await db.query.game.findFirst({ where: eq(game.id, id) })) ?? null,
      isPlayerInGame: async (gameId, playerId) => {
        const row = await db.query.playerGame.findFirst({
          where: and(eq(playerGame.gameId, gameId), eq(playerGame.playerId, playerId)),
        });
        return row !== undefined;
      },
    },
  );
}

export default async function sessionRoutes(app: FastifyInstance) {
  app.post('/:gameId/session/start', { preHandler: authenticate }, async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const service = buildSessionService();
    const session = await service.start(gameId, request.playerId);
    return reply.status(201).send({ session });
  });

  app.post('/:gameId/session/end', { preHandler: authenticate }, async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const service = buildSessionService();
    const session = await service.end(gameId, request.playerId);
    return reply.status(200).send({ session });
  });

  app.get('/:gameId/session/active', { preHandler: authenticate }, async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const service = buildSessionService();
    const session = await service.getActive(gameId, request.playerId);
    return reply.status(200).send({ session });
  });

  app.get('/:gameId/session/:sessionId/logs', { preHandler: authenticate }, async (request) => {
    const { gameId, sessionId } = request.params as { gameId: string; sessionId: string };
    const service = buildSessionService();
    const logs = await service.getLogs(gameId, sessionId, request.playerId);
    return { logs };
  });
}
