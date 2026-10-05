import type { FastifyInstance } from 'fastify';
import { authenticate } from '@infra/http/authenticate.js';
import type { CreateGameService } from './create-game/create-game.service.js';
import type { DeleteGameService } from './delete-game/delete-game.service.js';
import type { GameQueryService } from './game-query.service.js';
import { GamePresenter } from './game.presenter.js';
import {
  CreateGameBodySchema,
  GameListQuerySchema,
  GameParamsSchema,
  JoinGameBodySchema,
  UpdateGameBodySchema,
} from './game.schemas.js';
import type { JoinGameService } from './join-game/join-game.service.js';
import type { LeaveGameService } from './leave-game/leave-game.service.js';
import type { UpdateGameService } from './update-game/update-game.service.js';

export interface GameServices {
  createGame: CreateGameService;
  joinGame: JoinGameService;
  updateGame: UpdateGameService;
  deleteGame: DeleteGameService;
  leaveGame: LeaveGameService;
  query: GameQueryService;
}

export interface GameRoutesOptions {
  services: GameServices;
}

export default async function gameRoutes(
  app: FastifyInstance,
  opts: GameRoutesOptions,
) {
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const body = CreateGameBodySchema.parse(request.body);
    const game = await opts.services.createGame.execute(request.playerId, body);

    return reply.status(201).send({ game: GamePresenter.toHTTP(game) });
  });

  app.get('/mine', { preHandler: authenticate }, async (request) => {
    const page = GameListQuerySchema.parse(request.query);
    const games = await opts.services.query.getMine(request.playerId, page);

    return { games: games.map(GamePresenter.toSummary) };
  });

  app.get('/mastered', { preHandler: authenticate }, async (request) => {
    const games = await opts.services.query.getMastered(request.playerId);

    return { games: games.map(GamePresenter.toSummary) };
  });

  app.post('/join', { preHandler: authenticate }, async (request) => {
    const { inviteCode } = JoinGameBodySchema.parse(request.body);
    const game = await opts.services.joinGame.execute(
      inviteCode,
      request.playerId,
    );

    return { game: GamePresenter.toHTTP(game) };
  });

  app.get('/:id', { preHandler: authenticate }, async (request) => {
    const { id } = GameParamsSchema.parse(request.params);
    const game = await opts.services.query.getGame(id, request.playerId);

    return { game: GamePresenter.toHTTP(game) };
  });

  app.get('/:id/players', { preHandler: authenticate }, async (request) => {
    const { id } = GameParamsSchema.parse(request.params);
    const players = await opts.services.query.getPlayers(id, request.playerId);

    return { players: players.map(GamePresenter.toPlayer) };
  });

  app.patch('/:id', { preHandler: authenticate }, async (request) => {
    const { id } = GameParamsSchema.parse(request.params);
    const body = UpdateGameBodySchema.parse(request.body);
    const game = await opts.services.updateGame.execute(
      id,
      request.playerId,
      body,
    );

    return { game: GamePresenter.toHTTP(game) };
  });

  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = GameParamsSchema.parse(request.params);
    await opts.services.deleteGame.execute(id, request.playerId);

    return reply.status(204).send();
  });

  app.delete(
    '/:id/leave',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = GameParamsSchema.parse(request.params);
      await opts.services.leaveGame.execute(id, request.playerId);

      return reply.status(204).send();
    },
  );
}
