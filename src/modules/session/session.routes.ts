import type { FastifyInstance } from 'fastify';
import { authenticate } from '@infra/http/authenticate.js';
import type { EndSessionService } from './end-session/end-session.service.js';
import type { GetActiveService } from './get-active/get-active.service.js';
import type { ListLogsService } from './list-logs/list-logs.service.js';
import {
  GameParamsSchema,
  ListLogsQuerySchema,
  SessionLogParamsSchema,
} from './session.schemas.js';
import type { StartSessionService } from './start-session/start-session.service.js';

export interface SessionServices {
  startSession: StartSessionService;
  endSession: EndSessionService;
  getActive: GetActiveService;
  listLogs: ListLogsService;
}

export interface SessionRoutesOptions {
  services: SessionServices;
}

export default async function sessionRoutes(
  app: FastifyInstance,
  opts: SessionRoutesOptions,
) {
  app.post(
    '/:gameId/session/start',
    { preHandler: authenticate },
    async (request, reply) => {
      const { gameId } = GameParamsSchema.parse(request.params);
      const session = await opts.services.startSession.execute(
        gameId,
        request.playerId,
      );

      return reply.status(201).send({ session });
    },
  );

  app.post(
    '/:gameId/session/end',
    { preHandler: authenticate },
    async (request, reply) => {
      const { gameId } = GameParamsSchema.parse(request.params);
      const session = await opts.services.endSession.execute(
        gameId,
        request.playerId,
      );

      return reply.status(200).send({ session });
    },
  );

  app.get(
    '/:gameId/session/active',
    { preHandler: authenticate },
    async (request, reply) => {
      const { gameId } = GameParamsSchema.parse(request.params);
      const session = await opts.services.getActive.execute(
        gameId,
        request.playerId,
      );
      if (!session) return reply.status(204).send();

      return reply.status(200).send({ session });
    },
  );

  app.get(
    '/:gameId/session/:sessionId/logs',
    { preHandler: authenticate },
    async (request) => {
      const { gameId, sessionId } = SessionLogParamsSchema.parse(request.params);
      const page = ListLogsQuerySchema.parse(request.query);
      const logs = await opts.services.listLogs.execute(
        gameId,
        sessionId,
        request.playerId,
        page,
      );

      return { logs };
    },
  );
}
