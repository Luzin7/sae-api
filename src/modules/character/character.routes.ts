import type { FastifyInstance } from 'fastify';
import { authenticate } from '@infra/http/authenticate.js';
import type { AddItemService } from './items/add-item/add-item.service.js';
import type { DeleteItemService } from './items/delete-item/delete-item.service.js';
import type { UpdateItemService } from './items/update-item/update-item.service.js';
import type { CharacterQueryService } from './character-query.service.js';
import { CharacterPresenter } from './character.presenter.js';
import {
  CharacterGameParamsSchema,
  CharacterItemParamsSchema,
  CharacterListQuerySchema,
  CharacterParamsSchema,
  CreateCharacterBodySchema,
  CreateItemBodySchema,
  UpdateCharacterBodySchema,
  UpdateItemBodySchema,
  UpdateVitalsBodySchema,
  UpsertSkillBodySchema,
} from './character.schemas.js';
import type { CreateCharacterService } from './create-character/create-character.service.js';
import type { DeleteCharacterService } from './delete-character/delete-character.service.js';
import type { GetCharacterService } from './get-character/get-character.service.js';
import type { UpsertSkillService } from './skills/upsert-skill/upsert-skill.service.js';
import type { UpdateCharacterService } from './update-character/update-character.service.js';
import type { UpdateVitalsService } from './update-vitals/update-vitals.service.js';

export interface CharacterServices {
  createCharacter: CreateCharacterService;
  getCharacter: GetCharacterService;
  updateCharacter: UpdateCharacterService;
  deleteCharacter: DeleteCharacterService;
  updateVitals: UpdateVitalsService;
  addItem: AddItemService;
  updateItem: UpdateItemService;
  deleteItem: DeleteItemService;
  upsertSkill: UpsertSkillService;
  query: CharacterQueryService;
}

export interface CharacterRoutesOptions {
  services: CharacterServices;
}

export default async function characterRoutes(
  app: FastifyInstance,
  opts: CharacterRoutesOptions,
) {
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const body = CreateCharacterBodySchema.parse(request.body);
    const character = await opts.services.createCharacter.execute(
      request.playerId,
      body,
    );

    return reply
      .status(201)
      .send({ character: CharacterPresenter.toHTTP(character) });
  });

  app.get('/mine', { preHandler: authenticate }, async (request) => {
    const page = CharacterListQuerySchema.parse(request.query);
    const characters = await opts.services.query.listMine(
      request.playerId,
      page,
    );

    return { characters: characters.map(CharacterPresenter.toHTTP) };
  });

  app.get(
    '/game/:gameId',
    { preHandler: authenticate },
    async (request) => {
      const { gameId } = CharacterGameParamsSchema.parse(request.params);
      const characters = await opts.services.query.listByGame(
        gameId,
        request.playerId,
      );

      return { characters: characters.map(CharacterPresenter.toHTTP) };
    },
  );

  app.get('/:id', { preHandler: authenticate }, async (request) => {
    const { id } = CharacterParamsSchema.parse(request.params);
    const character = await opts.services.getCharacter.execute(
      id,
      request.playerId,
    );

    return { character: CharacterPresenter.toHTTP(character) };
  });

  app.patch('/:id', { preHandler: authenticate }, async (request) => {
    const { id } = CharacterParamsSchema.parse(request.params);
    const body = UpdateCharacterBodySchema.parse(request.body);
    const character = await opts.services.updateCharacter.execute(
      id,
      request.playerId,
      body,
    );

    return { character: CharacterPresenter.toHTTP(character) };
  });

  app.patch('/:id/hp', { preHandler: authenticate }, async (request) => {
    const { id } = CharacterParamsSchema.parse(request.params);
    const { currentHp } = UpdateVitalsBodySchema.parse(request.body);
    const character = await opts.services.updateVitals.execute(
      id,
      request.playerId,
      { currentHp },
    );

    return { character: CharacterPresenter.toHTTP(character) };
  });

  app.patch('/:id/pe', { preHandler: authenticate }, async (request) => {
    const { id } = CharacterParamsSchema.parse(request.params);
    const { currentEffort } = UpdateVitalsBodySchema.parse(request.body);
    const character = await opts.services.updateVitals.execute(
      id,
      request.playerId,
      { currentEffort },
    );

    return { character: CharacterPresenter.toHTTP(character) };
  });

  app.get('/:id/items', { preHandler: authenticate }, async (request) => {
    const { id } = CharacterParamsSchema.parse(request.params);
    const items = await opts.services.query.listItems(id, request.playerId);

    return { items };
  });

  app.post(
    '/:id/items',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = CharacterParamsSchema.parse(request.params);
      const body = CreateItemBodySchema.parse(request.body);
      const item = await opts.services.addItem.execute(
        id,
        request.playerId,
        body,
      );

      return reply.status(201).send({ item });
    },
  );

  app.patch(
    '/:id/items/:itemId',
    { preHandler: authenticate },
    async (request) => {
      const { id, itemId } = CharacterItemParamsSchema.parse(request.params);
      const body = UpdateItemBodySchema.parse(request.body);
      const item = await opts.services.updateItem.execute(
        id,
        itemId,
        request.playerId,
        body,
      );

      return { item };
    },
  );

  app.delete(
    '/:id/items/:itemId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id, itemId } = CharacterItemParamsSchema.parse(request.params);
      await opts.services.deleteItem.execute(id, itemId, request.playerId);

      return reply.status(204).send();
    },
  );

  app.get('/:id/skills', { preHandler: authenticate }, async (request) => {
    const { id } = CharacterParamsSchema.parse(request.params);
    const skills = await opts.services.query.listSkills(id, request.playerId);

    return { skills };
  });

  app.post(
    '/:id/skills',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = CharacterParamsSchema.parse(request.params);
      const body = UpsertSkillBodySchema.parse(request.body);
      const skill = await opts.services.upsertSkill.execute(
        id,
        request.playerId,
        body,
      );

      return reply.status(200).send({ skill });
    },
  );

  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = CharacterParamsSchema.parse(request.params);
    await opts.services.deleteCharacter.execute(id, request.playerId);

    return reply.status(204).send();
  });
}
