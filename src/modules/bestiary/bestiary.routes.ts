import type { FastifyInstance } from 'fastify';
import { authenticate } from '@infra/http/authenticate.js';
import { BestiaryPresenter } from './bestiary.presenter.js';
import {
  BestiaryGameParamsSchema,
  BestiaryParamsSchema,
  CreateMonsterBodySchema,
  UpdateMonsterBodySchema,
} from './bestiary.schemas.js';
import type { CreateMonsterService } from './create-monster/create-monster.service.js';
import type { DeleteMonsterService } from './delete-monster/delete-monster.service.js';
import type { MonsterQueryService } from './monster-query.service.js';
import type { UpdateMonsterService } from './update-monster/update-monster.service.js';

export interface BestiaryServices {
  createMonster: CreateMonsterService;
  updateMonster: UpdateMonsterService;
  deleteMonster: DeleteMonsterService;
  query: MonsterQueryService;
}

export interface BestiaryRoutesOptions {
  services: BestiaryServices;
}

export default async function bestiaryRoutes(
  app: FastifyInstance,
  opts: BestiaryRoutesOptions,
) {
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const body = CreateMonsterBodySchema.parse(request.body);
    const monster = await opts.services.createMonster.execute(
      request.playerId,
      body,
    );

    return reply
      .status(201)
      .send({ monster: BestiaryPresenter.toHTTP(monster) });
  });

  app.get('/game/:gameId', { preHandler: authenticate }, async (request) => {
    const { gameId } = BestiaryGameParamsSchema.parse(request.params);
    const monsters = await opts.services.query.listByGame(
      request.playerId,
      gameId,
    );

    return { monsters: monsters.map(BestiaryPresenter.toHTTP) };
  });

  app.get('/:id', { preHandler: authenticate }, async (request) => {
    const { id } = BestiaryParamsSchema.parse(request.params);
    const monster = await opts.services.query.getById(request.playerId, id);

    return { monster: BestiaryPresenter.toHTTP(monster) };
  });

  app.patch('/:id', { preHandler: authenticate }, async (request) => {
    const { id } = BestiaryParamsSchema.parse(request.params);
    const body = UpdateMonsterBodySchema.parse(request.body);
    const monster = await opts.services.updateMonster.execute(
      request.playerId,
      id,
      body,
    );

    return { monster: BestiaryPresenter.toHTTP(monster) };
  });

  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = BestiaryParamsSchema.parse(request.params);
    await opts.services.deleteMonster.execute(request.playerId, id);

    return reply.status(204).send();
  });
}
