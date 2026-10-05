import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authPlugin from '../../plugins/auth.plugin.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { CharacterQueryService } from './character-query.service.js';
import type { CharacterRepository } from './character.repository.js';
import characterRoutes, { type CharacterServices } from './character.routes.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeItem,
  makeMembership,
  makeSkill,
  makeSkillSummary,
} from './character.testkit.js';
import { CreateCharacterService } from './create-character/create-character.service.js';
import { DeleteCharacterService } from './delete-character/delete-character.service.js';
import { GetCharacterService } from './get-character/get-character.service.js';
import { AddItemService } from './items/add-item/add-item.service.js';
import { DeleteItemService } from './items/delete-item/delete-item.service.js';
import { UpdateItemService } from './items/update-item/update-item.service.js';
import { UpsertSkillService } from './skills/upsert-skill/upsert-skill.service.js';
import { UpdateCharacterService } from './update-character/update-character.service.js';
import { UpdateVitalsService } from './update-vitals/update-vitals.service.js';

process.env.JWT_SECRET = 'test-secret-key-for-tests-only';

const GAME_ID = '11111111-1111-1111-1111-111111111111';
const SKILL_ID = '22222222-2222-2222-2222-222222222222';

function fixedRng(): number {
  return 1;
}

function makeServices(
  characters: CharacterRepository,
  membership: GameAccess,
): CharacterServices {
  return {
    createCharacter: new CreateCharacterService(
      characters,
      membership,
      fixedRng,
    ),
    getCharacter: new GetCharacterService(characters),
    updateCharacter: new UpdateCharacterService(characters, fixedRng),
    deleteCharacter: new DeleteCharacterService(characters),
    updateVitals: new UpdateVitalsService(characters),
    addItem: new AddItemService(characters),
    updateItem: new UpdateItemService(characters),
    deleteItem: new DeleteItemService(characters),
    upsertSkill: new UpsertSkillService(characters),
    query: new CharacterQueryService(characters, membership),
  };
}

async function buildTestApp(services: CharacterServices) {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  registerErrorHandler(app);
  await app.register(characterRoutes, { prefix: '/characters', services });
  return app;
}

function makeToken(app: Awaited<ReturnType<typeof buildTestApp>>) {
  return app.jwt.sign({ sub: 'player-1', name: 'Tester' });
}

function createPayload() {
  return {
    gameId: GAME_ID,
    nickname: 'Hero',
    personality: 'Erudito',
    posture: 'Abrutalhado',
    socialClass: 'plebeu',
  };
}

beforeEach(() => vi.clearAllMocks());

describe('character routes', () => {
  it('returns 401 without authentication', async () => {
    const app = await buildTestApp(
      makeServices(makeCharacterRepository(), makeMembership()),
    );

    const res = await app.inject({ method: 'POST', url: '/characters' });

    expect(res.statusCode).toBe(401);
  });

  it('rejects a create request with an invalid body', async () => {
    const app = await buildTestApp(
      makeServices(makeCharacterRepository(), makeMembership()),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/characters',
      payload: { nickname: 'Hero' },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('creates a character for a game member', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCharacter());
    const app = await buildTestApp(makeServices(characters, membership));

    const res = await app.inject({
      method: 'POST',
      url: '/characters',
      payload: createPayload(),
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().character.nickname).toBe('Hero');
  });

  it('creates a character for the game master who is not a member', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'player-1',
    });
    vi.mocked(membership.isMember).mockResolvedValue(false);
    vi.mocked(characters.create).mockResolvedValue(makeCharacter());
    const app = await buildTestApp(makeServices(characters, membership));

    const res = await app.inject({
      method: 'POST',
      url: '/characters',
      payload: createPayload(),
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(201);
  });

  it('returns 403 when creating in a game the player does not belong to', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(false);
    const app = await buildTestApp(makeServices(characters, membership));

    const res = await app.inject({
      method: 'POST',
      url: '/characters',
      payload: createPayload(),
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when reading a character owned by another player', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'GET',
      url: '/characters/char-1',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns the owned character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'GET',
      url: '/characters/char-1',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().character.id).toBe('char-1');
  });

  it('updates vitals through the dedicated rule', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ maxHp: 28 }),
    );
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'PATCH',
      url: '/characters/char-1/hp',
      payload: { currentHp: 999 },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(characters.save).toHaveBeenCalledWith('char-1', {
      currentHp: 28,
      currentEffort: makeCharacter().currentEffort,
    });
  });

  it('deletes a character for its owner', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.delete).mockResolvedValue(undefined);
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'DELETE',
      url: '/characters/char-1',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(204);
    expect(characters.delete).toHaveBeenCalledWith('char-1');
  });

  it('adds and lists items for an owned character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.addItem).mockResolvedValue(makeItem());
    vi.mocked(characters.findItems).mockResolvedValue([makeItem()]);
    const app = await buildTestApp(makeServices(characters, makeMembership()));
    const cookie = `token=${makeToken(app)}`;

    const created = await app.inject({
      method: 'POST',
      url: '/characters/char-1/items',
      payload: { name: 'Knife', type: 'weapon' },
      headers: { cookie },
    });
    const listed = await app.inject({
      method: 'GET',
      url: '/characters/char-1/items',
      headers: { cookie },
    });

    expect(created.statusCode).toBe(201);
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toHaveLength(1);
  });

  it('upserts a skill using skillId and proficiencyBonus', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ constitutionProficiency: 'especialista' }),
    );
    vi.mocked(characters.findSkillById).mockResolvedValue(makeSkillSummary());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.upsertSkill).mockResolvedValue(makeSkill());
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'POST',
      url: '/characters/char-1/skills',
      payload: { skillId: SKILL_ID, proficiencyBonus: 3 },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(characters.upsertSkill).toHaveBeenCalledWith('char-1', SKILL_ID, 3);
  });
});
