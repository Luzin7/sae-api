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
  makeNotifier,
  makeSkill,
  makeSkillDetail,
  makeSkillSummary,
} from './character.testkit.js';
import { CreateCharacterService } from './create-character/create-character.service.js';
import { DeleteCharacterService } from './delete-character/delete-character.service.js';
import { GetCharacterService } from './get-character/get-character.service.js';
import { GetSheetService } from './get-sheet/get-sheet.service.js';
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
  const notifier = makeNotifier();

  return {
    createCharacter: new CreateCharacterService(
      characters,
      membership,
      fixedRng,
      notifier,
    ),
    getCharacter: new GetCharacterService(characters, membership),
    getSheet: new GetSheetService(characters, membership),
    updateCharacter: new UpdateCharacterService(
      characters,
      membership,
      fixedRng,
      notifier,
    ),
    deleteCharacter: new DeleteCharacterService(characters, notifier),
    updateVitals: new UpdateVitalsService(characters, membership, notifier),
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
    heightCm: 180,
    weightKg: 80,
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

describe('character read access', () => {
  it('lets the owner read the character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'GET',
      url: '/characters/char-1',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('lets the game master read the character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    const membership = makeMembership();
    vi.mocked(membership.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'player-1',
    });
    const app = await buildTestApp(makeServices(characters, membership));

    const res = await app.inject({
      method: 'GET',
      url: '/characters/char-1',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('lets the owner read items and skills', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findItems).mockResolvedValue([makeItem()]);
    vi.mocked(characters.findSkillDetails).mockResolvedValue([
      makeSkillDetail(),
    ]);
    const app = await buildTestApp(makeServices(characters, makeMembership()));
    const cookie = `token=${makeToken(app)}`;

    const items = await app.inject({
      method: 'GET',
      url: '/characters/char-1/items',
      headers: { cookie },
    });
    const skills = await app.inject({
      method: 'GET',
      url: '/characters/char-1/skills',
      headers: { cookie },
    });

    expect(items.statusCode).toBe(200);
    expect(items.json().items).toHaveLength(1);
    expect(skills.statusCode).toBe(200);
    expect(skills.json().skills[0].skillName).toBe('Vitalidade');
    expect(skills.json().skills[0].attribute).toBe('constitution');
  });

  it('lets the game master read items and skills', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    vi.mocked(characters.findItems).mockResolvedValue([makeItem()]);
    vi.mocked(characters.findSkillDetails).mockResolvedValue([
      makeSkillDetail(),
    ]);
    const membership = makeMembership();
    vi.mocked(membership.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'player-1',
    });
    const app = await buildTestApp(makeServices(characters, membership));
    const cookie = `token=${makeToken(app)}`;

    const items = await app.inject({
      method: 'GET',
      url: '/characters/char-1/items',
      headers: { cookie },
    });
    const skills = await app.inject({
      method: 'GET',
      url: '/characters/char-1/skills',
      headers: { cookie },
    });

    expect(items.statusCode).toBe(200);
    expect(skills.statusCode).toBe(200);
  });

  it('returns 403 to a player who is neither owner nor master', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    const app = await buildTestApp(makeServices(characters, makeMembership()));
    const cookie = `token=${makeToken(app)}`;

    const items = await app.inject({
      method: 'GET',
      url: '/characters/char-1/items',
      headers: { cookie },
    });
    const skills = await app.inject({
      method: 'GET',
      url: '/characters/char-1/skills',
      headers: { cookie },
    });
    const sheet = await app.inject({
      method: 'GET',
      url: '/characters/char-1/sheet',
      headers: { cookie },
    });

    expect(items.statusCode).toBe(403);
    expect(skills.statusCode).toBe(403);
    expect(sheet.statusCode).toBe(403);
  });

  it('returns 404 for a missing character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(null);
    const app = await buildTestApp(makeServices(characters, makeMembership()));
    const cookie = `token=${makeToken(app)}`;

    const character = await app.inject({
      method: 'GET',
      url: '/characters/missing',
      headers: { cookie },
    });
    const items = await app.inject({
      method: 'GET',
      url: '/characters/missing/items',
      headers: { cookie },
    });
    const skills = await app.inject({
      method: 'GET',
      url: '/characters/missing/skills',
      headers: { cookie },
    });
    const sheet = await app.inject({
      method: 'GET',
      url: '/characters/missing/sheet',
      headers: { cookie },
    });

    expect(character.statusCode).toBe(404);
    expect(items.statusCode).toBe(404);
    expect(skills.statusCode).toBe(404);
    expect(sheet.statusCode).toBe(404);
  });

  it('returns the whole sheet in one response for the owner', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findItems).mockResolvedValue([makeItem()]);
    vi.mocked(characters.findSkillDetails).mockResolvedValue([
      makeSkillDetail(),
    ]);
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'GET',
      url: '/characters/char-1/sheet',
      headers: { cookie: `token=${makeToken(app)}` },
    });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.character.id).toBe('char-1');
    expect(body.items).toHaveLength(1);
    expect(body.skills[0].skillName).toBe('Vitalidade');
    expect(body.skills[0].attribute).toBe('constitution');
  });

  it('returns the whole sheet to the game master', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    vi.mocked(characters.findItems).mockResolvedValue([makeItem()]);
    vi.mocked(characters.findSkillDetails).mockResolvedValue([
      makeSkillDetail(),
    ]);
    const membership = makeMembership();
    vi.mocked(membership.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'player-1',
    });
    const app = await buildTestApp(makeServices(characters, membership));

    const res = await app.inject({
      method: 'GET',
      url: '/characters/char-1/sheet',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().character.playerId).toBe('other-player');
  });
});

describe('character size validation', () => {
  async function postCharacter(payload: Record<string, unknown>) {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCharacter());
    const app = await buildTestApp(makeServices(characters, membership));

    const res = await app.inject({
      method: 'POST',
      url: '/characters',
      payload,
      headers: { cookie: `token=${makeToken(app)}` },
    });

    return { res, characters };
  }

  async function patchCharacter(
    payload: Record<string, unknown>,
    stored: Parameters<typeof makeCharacter>[0] = {},
  ) {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({
        heightCm: 160,
        weightKg: 60,
        size: 'pequeno',
        ...stored,
      }),
    );
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'PATCH',
      url: '/characters/char-1',
      payload,
      headers: { cookie: `token=${makeToken(app)}` },
    });

    return { res, characters };
  }

  it('rejects a create without any height source', async () => {
    const { res, characters } = await postCharacter({
      ...createPayload(),
      heightCm: undefined,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'heightCm: Informe a altura ou escolha rolar.',
    );
    expect(characters.create).not.toHaveBeenCalled();
  });

  it('rejects a create without any weight source', async () => {
    const { res, characters } = await postCharacter({
      ...createPayload(),
      weightKg: undefined,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'weightKg: Informe o peso ou escolha rolar.',
    );
    expect(characters.create).not.toHaveBeenCalled();
  });

  it('rejects a create with both heightCm and heightRoll', async () => {
    const { res } = await postCharacter({
      ...createPayload(),
      heightRoll: 'min',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'heightCm: Informe a altura ou a rolagem, não as duas.',
    );
  });

  it('rejects a create with both weightKg and weightRoll', async () => {
    const { res } = await postCharacter({
      ...createPayload(),
      weightRoll: 'max',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'weightKg: Informe o peso ou a rolagem, não as duas.',
    );
  });

  it('rejects a height below the exact band', async () => {
    const { res } = await postCharacter({ ...createPayload(), heightCm: 100 });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'heightCm: Altura deve estar entre 150 e 250 cm.',
    );
  });

  it('rejects a height above the exact band', async () => {
    const { res } = await postCharacter({ ...createPayload(), heightCm: 300 });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'heightCm: Altura deve estar entre 150 e 250 cm.',
    );
  });

  it('rejects a weight below the exact band', async () => {
    const { res } = await postCharacter({ ...createPayload(), weightKg: 10 });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'weightKg: Peso deve estar entre 50 e 150 kg.',
    );
  });

  it('rejects a weight above the exact band', async () => {
    const { res } = await postCharacter({ ...createPayload(), weightKg: 200 });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'weightKg: Peso deve estar entre 50 e 150 kg.',
    );
  });

  it('rejects a decimal weight', async () => {
    const { res } = await postCharacter({ ...createPayload(), weightKg: 70.5 });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'weightKg: Peso deve ser um número inteiro.',
    );
  });

  it('updates a character with a legacy decimal weight when weight is not sent', async () => {
    const { res } = await patchCharacter(
      { nickname: 'Renamed' },
      { weightKg: 60.5 },
    );

    expect(res.statusCode).toBe(200);
  });

  it('persists values inside the roll bands', async () => {
    const { res, characters } = await postCharacter({
      ...createPayload(),
      heightCm: undefined,
      weightKg: undefined,
      heightRoll: 'min',
      weightRoll: 'max',
    });

    expect(res.statusCode).toBe(201);
    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({ heightCm: 149, weightKg: 151 }),
    );
  });

  it('persists explicit height and weight inside the exact bands', async () => {
    const { res, characters } = await postCharacter(createPayload());

    expect(res.statusCode).toBe(201);
    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({ heightCm: 180, weightKg: 80 }),
    );
  });

  it('updates only the nickname without requiring size sources', async () => {
    const { res, characters } = await patchCharacter({ nickname: 'Renamed' });

    expect(res.statusCode).toBe(200);
    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({
        nickname: 'Renamed',
        heightCm: 160,
        weightKg: 60,
      }),
    );
  });

  it('rejects an update with both heightCm and heightRoll', async () => {
    const { res, characters } = await patchCharacter({
      heightCm: 180,
      heightRoll: 'min',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'heightCm: Informe a altura ou a rolagem, não as duas.',
    );
    expect(characters.save).not.toHaveBeenCalled();
  });

  it('rejects an update with heightCm outside the exact band', async () => {
    const { res, characters } = await patchCharacter({ heightCm: 300 });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'heightCm: Altura deve estar entre 150 e 250 cm.',
    );
    expect(characters.save).not.toHaveBeenCalled();
  });

  it('rejects an update with repeated afflictions', async () => {
    const { res, characters } = await patchCharacter({
      afflictions: ['fobia', 'fobia'],
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('Aflição repetida.');
    expect(characters.save).not.toHaveBeenCalled();
  });
});

describe('character sheet creation contract', () => {
  async function postCharacter(payload: Record<string, unknown>) {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findSkillsByIds).mockResolvedValue([
      makeSkillSummary({ id: SKILL_ID }),
    ]);
    const app = await buildTestApp(makeServices(characters, membership));

    const res = await app.inject({
      method: 'POST',
      url: '/characters',
      payload,
      headers: { cookie: `token=${makeToken(app)}` },
    });

    return { res, characters };
  }

  async function patchCharacter(payload: Record<string, unknown>) {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ afflictions: ['medo de altura'] }),
    );
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    return app.inject({
      method: 'PATCH',
      url: '/characters/char-1',
      payload,
      headers: { cookie: `token=${makeToken(app)}` },
    });
  }

  it('accepts afflictions as keys', async () => {
    const { res } = await postCharacter({
      ...createPayload(),
      afflictions: ['fobia'],
    });

    expect(res.statusCode).toBe(201);
  });

  it('rejects free-text afflictions', async () => {
    const { res } = await postCharacter({
      ...createPayload(),
      afflictions: ['medo de altura'],
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('Aflição inválida.');
  });

  it('rejects repeated afflictions', async () => {
    const { res } = await postCharacter({
      ...createPayload(),
      afflictions: ['fobia', 'fobia'],
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('Aflição repetida.');
  });

  it('ignores np and creates the character at NP 1', async () => {
    const { res, characters } = await postCharacter({
      ...createPayload(),
      np: 20,
    });

    expect(res.statusCode).toBe(201);
    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({ np: 1 }),
    );
  });

  it('creates the character with its skills', async () => {
    const { res, characters } = await postCharacter({
      ...createPayload(),
      skills: [{ skillId: SKILL_ID, proficiencyBonus: 2 }],
    });

    expect(res.statusCode).toBe(201);
    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({
        skills: [{ skillId: SKILL_ID, proficiencyBonus: 2 }],
      }),
    );
  });

  it('rejects a repeated skill', async () => {
    const { res, characters } = await postCharacter({
      ...createPayload(),
      skills: [
        { skillId: SKILL_ID, proficiencyBonus: 1 },
        { skillId: SKILL_ID, proficiencyBonus: 1 },
      ],
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('Perícia repetida.');
    expect(characters.create).not.toHaveBeenCalled();
  });

  it('rejects free-text afflictions on update', async () => {
    const res = await patchCharacter({ afflictions: ['medo de altura'] });

    expect(res.statusCode).toBe(400);
  });

  it('updates a legacy character without revalidating its afflictions', async () => {
    const res = await patchCharacter({ nickname: 'Renamed' });

    expect(res.statusCode).toBe(200);
  });

  it('rejects a skill bonus above the cap', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ np: 20, constitutionProficiency: 'versado' }),
    );
    vi.mocked(characters.findSkillById).mockResolvedValue(makeSkillSummary());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'POST',
      url: '/characters/char-1/skills',
      payload: { skillId: SKILL_ID, proficiencyBonus: 21 },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe(
      'Bônus de Vitalidade acima do limite de +20.',
    );
  });
});

describe('character write access', () => {
  function masterMembership(): GameAccess {
    const membership = makeMembership();
    vi.mocked(membership.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'player-1',
    });

    return membership;
  }

  async function patchVitals(
    route: 'hp' | 'pe',
    payload: Record<string, number>,
    characters: CharacterRepository,
    membership: GameAccess,
  ) {
    const app = await buildTestApp(makeServices(characters, membership));

    return app.inject({
      method: 'PATCH',
      url: `/characters/char-1/${route}`,
      payload,
      headers: { cookie: `token=${makeToken(app)}` },
    });
  }

  it('lets the master change hp on another player character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player', currentHp: 10, maxHp: 26 }),
    );
    vi.mocked(characters.save).mockResolvedValue(
      makeCharacter({ playerId: 'other-player', currentHp: 12 }),
    );

    const res = await patchVitals(
      'hp',
      { currentHp: 12 },
      characters,
      masterMembership(),
    );

    expect(res.statusCode).toBe(200);
  });

  it('lets the master change effort on another player character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({
        playerId: 'other-player',
        currentEffort: 5,
        maxEffort: 20,
      }),
    );
    vi.mocked(characters.save).mockResolvedValue(
      makeCharacter({ playerId: 'other-player', currentEffort: 8 }),
    );

    const res = await patchVitals(
      'pe',
      { currentEffort: 8 },
      characters,
      masterMembership(),
    );

    expect(res.statusCode).toBe(200);
  });

  it('lets the owner change their own effort', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ currentEffort: 5, maxEffort: 20 }),
    );
    vi.mocked(characters.save).mockResolvedValue(
      makeCharacter({ currentEffort: 8 }),
    );

    const res = await patchVitals(
      'pe',
      { currentEffort: 8 },
      characters,
      makeMembership(),
    );

    expect(res.statusCode).toBe(200);
  });

  it('returns 403 to an unrelated player for hp and pe', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    const membership = makeMembership();

    const hp = await patchVitals(
      'hp',
      { currentHp: 10 },
      characters,
      membership,
    );
    const pe = await patchVitals(
      'pe',
      { currentEffort: 10 },
      characters,
      membership,
    );

    expect(hp.statusCode).toBe(403);
    expect(pe.statusCode).toBe(403);
  });

  it('lets the master change np on another player character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(
      makeCharacter({ playerId: 'other-player', np: 2 }),
    );
    const app = await buildTestApp(
      makeServices(characters, masterMembership()),
    );

    const res = await app.inject({
      method: 'PATCH',
      url: '/characters/char-1',
      payload: { np: 2 },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('forbids a player from changing np', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'PATCH',
      url: '/characters/char-1',
      payload: { np: 2 },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
