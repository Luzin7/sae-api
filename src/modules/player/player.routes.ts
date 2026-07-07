import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { PlayerService } from './player.service.js';
import { UpdatePlayerBodySchema } from './player.schemas.js';
import { db } from '../../db/index.js';
import { player, playerGame } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { hashPassword } from '../../lib/hash.js';
import { ForbiddenError } from '../../lib/errors.js';

function buildPlayerService(): PlayerService {
  return new PlayerService(
    {
      findById: async (id) =>
        (await db.query.player.findFirst({ where: eq(player.id, id) })) ?? null,
      findByName: async (name) =>
        (await db.query.player.findFirst({ where: eq(player.name, name) })) ?? null,
      update: async (id, data) => {
        const [updated] = await db.update(player).set(data).where(eq(player.id, id)).returning();
        return updated!;
      },
    },
    { hashPassword },
  );
}

async function shareGame(requesterId: string, targetId: string): Promise<boolean> {
  if (requesterId === targetId) return true;
  const requesterGame = alias(playerGame, 'rg');
  const targetGame = alias(playerGame, 'tg');
  const rows = await db
    .select({ gameId: requesterGame.gameId })
    .from(requesterGame)
    .innerJoin(targetGame, eq(requesterGame.gameId, targetGame.gameId))
    .where(and(eq(requesterGame.playerId, requesterId), eq(targetGame.playerId, targetId)))
    .limit(1);
  return rows.length > 0;
}

export default async function playerRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: authenticate }, async (request) => {
    const service = buildPlayerService();
    const player = await service.getById(request.playerId);
    return { player };
  });

  app.patch('/me', { preHandler: authenticate }, async (request) => {
    const body = UpdatePlayerBodySchema.parse(request.body);
    const service = buildPlayerService();
    const player = await service.update(request.playerId, body);
    return { player };
  });

  app.get('/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    if (!(await shareGame(request.playerId, id))) {
      throw new ForbiddenError();
    }
    const service = buildPlayerService();
    const player = await service.getById(id);
    return { player };
  });
}
