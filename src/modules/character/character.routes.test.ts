import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authPlugin from '../../plugins/auth.plugin.js';
import rateLimitPlugin from '../../plugins/rate-limit.plugin.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { CharacterVersionConflictError } from './character.errors.js';
import { CharacterQueryService } from './character-query.service.js';
import type { CharacterRepository } from './character.repository.js';
import characterRoutes, { type CharacterServices } from './character.routes.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeCreateResult,
  makeItem,
  makeMembership,
  makeNotifier,
  makeSkill,
  makeSkillDetail,
  makeSkillSummary,
  stubUpdateSheet,
} from './character.testkit.js';
import { CreateCharacterService } from './create-character/create-character.service.js';
import { DeleteCharacterService } from './delete-character/delete-character.service.js';
import { GetCharacterService } from './get-character/get-character.service.js';
import { GetSheetService } from './get-sheet/get-sheet.service.js';
import { AddItemService } from './items/add-item/add-item.service.js';
import { DeleteItemService } from './items/delete-item/delete-item.service.js';
import { UpdateItemService } from './items/update-item/update-item.service.js';
import { PreviewCharacterService } from './preview-character/preview-character.service.js';
import { UpsertSkillService } from './skills/upsert-skill/upsert-skill.service.js';
import { UpdateCharacterService } from './update-character/update-character.service.js';
import { ChangeEffortService } from './change-effort/change-effort.service.js';
import { ChangeHpService } from './change-hp/change-hp.service.js';

process.env.JWT_SECRET = 'test-secret-key-for-tests-only';

const GAME_ID = '11111111-1111-1111-1111-111111111111';
const CLIENT_REQUEST_ID = '33333333-3333-3333-3333-333333333333';
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
    previewCharacter: new PreviewCharacterService(characters),
    getCharacter: new GetCharacterService(characters, membership),
    getSheet: new GetSheetService(characters, membership),
    updateCharacter: new UpdateCharacterService(
      characters,
      membership,
      fixedRng,
      notifier,
    ),
    deleteCharacter: new DeleteCharacterService(
      characters,
      membership,
      notifier,
    ),
    changeHp: new ChangeHpService(characters, membership, notifier),
    changeEffort: new ChangeEffortService(characters, membership, notifier),
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

function makeToken(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  sub = 'player-1',
) {
  return app.jwt.sign({ sub, name: 'Tester' });
}

function createPayload() {
  return {
    gameId: GAME_ID,
    clientRequestId: CLIENT_REQUEST_ID,
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
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());
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
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());
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

  it('PS delta +5 from 10 answers with the character at 15 PS', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ currentHp: 10, maxHp: 28 }),
    );
    vi.mocked(characters.changeHp).mockResolvedValue({
      character: makeCharacter({ currentHp: 15, maxHp: 28 }),
      oldEffort: 0,
      oldHp: 10,
    });
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'PATCH',
      url: '/characters/char-1/hp',
      payload: { delta: 5 },
      headers: { cookie: `token=${makeToken(app, 'master-1')}` },
    });

    expect(res.statusCode).toBe(200);
    expect(characters.changeHp).toHaveBeenCalledWith('char-1', 5);
    expect(res.json().character.currentHp).toBe(15);
  });

  it('answers 403 to the character owner changing PS and writes nothing', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'PATCH',
      url: '/characters/char-1/hp',
      payload: { delta: 5 },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(403);
    expect(characters.changeHp).not.toHaveBeenCalled();
  });

  it.each([{ delta: 0 }, { delta: 1001 }, { delta: 1.5 }, { currentHp: 10 }])(
    'rejects the hp body %j',
    async (payload) => {
      const characters = makeCharacterRepository();
      const app = await buildTestApp(
        makeServices(characters, makeMembership()),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/characters/char-1/hp',
        payload,
        headers: { cookie: `token=${makeToken(app)}` },
      });

      expect(res.statusCode).toBe(400);
      expect(characters.changeHp).not.toHaveBeenCalled();
    },
  );

  it('lets the master delete a sheet of their table', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'player-1' }),
    );
    vi.mocked(characters.delete).mockResolvedValue(undefined);
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'DELETE',
      url: '/characters/char-1',
      headers: { cookie: `token=${makeToken(app, 'master-1')}` },
    });

    expect(res.statusCode).toBe(204);
    expect(characters.delete).toHaveBeenCalledWith('char-1');
  });

  it('returns 403 when a non-master player deletes a sheet', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'DELETE',
      url: '/characters/char-1',
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(403);
    expect(characters.delete).not.toHaveBeenCalled();
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
    expect(characters.upsertSkill).toHaveBeenCalledWith({
      characterId: 'char-1',
      skillId: SKILL_ID,
      proficiencyBonus: 3,
      deriveLimits: expect.any(Function),
    });
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
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());
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
    const current = makeCharacter({
      heightCm: 160,
      weightKg: 60,
      size: 'pequeno',
      ...stored,
    });
    vi.mocked(characters.findById).mockResolvedValue(current);
    stubUpdateSheet(characters, current);
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'PATCH',
      url: '/characters/char-1',
      payload: { version: 0, ...payload },
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
      'heightCm: Informe a altura ou deixe para o destino.',
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
      'weightKg: Informe o peso ou deixe para o destino.',
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
      'heightCm: Escolha a altura ou deixe para o destino, não os dois.',
    );
  });

  it('rejects a create with both weightKg and weightRoll', async () => {
    const { res } = await postCharacter({
      ...createPayload(),
      weightRoll: 'max',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'weightKg: Escolha o peso ou deixe para o destino, não os dois.',
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
    expect(characters.updateSheet).toHaveBeenCalledOnce();
    expect(res.json().character.version).toBe(0);
  });

  it('rejects an update with both heightCm and heightRoll', async () => {
    const { res, characters } = await patchCharacter({
      heightCm: 180,
      heightRoll: 'min',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'heightCm: Escolha a altura ou deixe para o destino, não os dois.',
    );
    expect(characters.updateSheet).not.toHaveBeenCalled();
  });

  it('rejects an update with heightCm outside the exact band', async () => {
    const { res, characters } = await patchCharacter({ heightCm: 300 });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain(
      'heightCm: Altura deve estar entre 150 e 250 cm.',
    );
    expect(characters.updateSheet).not.toHaveBeenCalled();
  });

  it('rejects an update with repeated afflictions', async () => {
    const { res, characters } = await patchCharacter({
      afflictions: ['fobia', 'fobia'],
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('Aflição repetida.');
    expect(characters.updateSheet).not.toHaveBeenCalled();
  });
});

describe('character sheet creation contract', () => {
  async function postCharacter(payload: Record<string, unknown>) {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());
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
    const current = makeCharacter({ afflictions: ['medo de altura'] });
    vi.mocked(characters.findById).mockResolvedValue(current);
    stubUpdateSheet(characters, current);
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    return app.inject({
      method: 'PATCH',
      url: '/characters/char-1',
      payload: { version: 0, ...payload },
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

  function makeEffortRepository(newEffort: number, playerId = 'player-1') {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId, currentEffort: 5, maxEffort: 20 }),
    );
    vi.mocked(characters.changeEffort).mockResolvedValue({
      character: makeCharacter({ playerId, currentEffort: newEffort }),
      oldEffort: 5,
      oldHp: 26,
    });

    return characters;
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
    vi.mocked(characters.changeHp).mockResolvedValue({
      character: makeCharacter({ playerId: 'other-player', currentHp: 12 }),
      oldEffort: 0,
      oldHp: 10,
    });

    const res = await patchVitals(
      'hp',
      { delta: 2 },
      characters,
      masterMembership(),
    );

    expect(res.statusCode).toBe(200);
  });

  it('lets the master change effort on another player character', async () => {
    const characters = makeEffortRepository(8, 'other-player');

    const res = await patchVitals(
      'pe',
      { delta: 3 },
      characters,
      masterMembership(),
    );

    expect(res.statusCode).toBe(200);
    expect(characters.changeEffort).toHaveBeenCalledWith('char-1', 3);
  });

  it('delta 3 from 5 PE answers with the character at 8 PE', async () => {
    const characters = makeEffortRepository(8);

    const res = await patchVitals(
      'pe',
      { delta: 3 },
      characters,
      masterMembership(),
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().character.currentEffort).toBe(8);
  });

  it('answers 403 to the character owner changing PE and writes nothing', async () => {
    const characters = makeEffortRepository(8);

    const res = await patchVitals(
      'pe',
      { delta: 3 },
      characters,
      makeMembership(),
    );

    expect(res.statusCode).toBe(403);
    expect(characters.changeEffort).not.toHaveBeenCalled();
  });

  it.each([0, 101, -101, 1.5])('rejects delta %s', async (delta) => {
    const characters = makeEffortRepository(8);

    const res = await patchVitals(
      'pe',
      { delta },
      characters,
      makeMembership(),
    );

    expect(res.statusCode).toBe(400);
    expect(characters.changeEffort).not.toHaveBeenCalled();
  });

  it('rejects the old currentEffort body', async () => {
    const characters = makeEffortRepository(8);

    const res = await patchVitals(
      'pe',
      { currentEffort: 8 },
      characters,
      makeMembership(),
    );

    expect(res.statusCode).toBe(400);
    expect(characters.changeEffort).not.toHaveBeenCalled();
  });

  it('returns 403 to an unrelated player for hp and pe', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    const membership = makeMembership();

    const hp = await patchVitals('hp', { delta: 2 }, characters, membership);
    const pe = await patchVitals('pe', { delta: 2 }, characters, membership);

    expect(hp.statusCode).toBe(403);
    expect(pe.statusCode).toBe(403);
  });

  it('lets the master change np on another player character', async () => {
    const characters = makeCharacterRepository();
    const current = makeCharacter({ playerId: 'other-player' });
    vi.mocked(characters.findById).mockResolvedValue(current);
    stubUpdateSheet(characters, current);
    const app = await buildTestApp(
      makeServices(characters, masterMembership()),
    );

    const res = await app.inject({
      method: 'PATCH',
      url: '/characters/char-1',
      payload: { version: 0, np: 2 },
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
      payload: { version: 0, np: 2 },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('character preview contract', () => {
  async function postPreview(payload: Record<string, unknown>, auth = true) {
    const characters = makeCharacterRepository();
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'POST',
      url: '/characters/preview',
      payload,
      headers: auth ? { cookie: `token=${makeToken(app)}` } : {},
    });

    return { res, characters };
  }

  it('returns 401 without authentication', async () => {
    const { res } = await postPreview({}, false);

    expect(res.statusCode).toBe(401);
  });

  it('accepts an empty body', async () => {
    const { res } = await postPreview({});

    expect(res.statusCode).toBe(200);
    expect(res.json().preview.hitDie).toBeNull();
  });

  it('returns derived values for a half-filled form', async () => {
    const { res, characters } = await postPreview({
      np: 1,
      constitution: 1,
      socialClass: 'plebeu',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().preview).toMatchObject({
      hitDie: 'd10',
      maxHp: 30,
      startingWealth: { min: 80, max: 320 },
    });
    expect(characters.create).not.toHaveBeenCalled();
  });

  it('derives size from a rolled band and an exact value', async () => {
    const { res } = await postPreview({
      np: 1,
      heightRoll: 'min',
      weightKg: 70,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().preview.size).toEqual({
      factor: 0.5,
      category: 'pequeno',
      next: { category: 'medio', factorNeeded: 2 },
    });
  });

  it('rejects an exact value together with a roll for the same dimension', async () => {
    const { res } = await postPreview({
      np: 1,
      heightCm: 180,
      heightRoll: 'max',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
  });

  it('rejects an invalid attribute value', async () => {
    const { res } = await postPreview({ constitution: 0 });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
  });
});

describe('character preview rate limit', () => {
  const PREVIEW_LIMIT = 60;

  async function buildLimitedApp(characters: CharacterRepository) {
    const app = Fastify({ logger: false });
    await app.register(rateLimitPlugin);
    await app.register(authPlugin);
    registerErrorHandler(app);
    await app.register(characterRoutes, {
      prefix: '/characters',
      services: makeServices(characters, makeMembership()),
    });
    return app;
  }

  function preview(
    app: Awaited<ReturnType<typeof buildLimitedApp>>,
    player: string,
  ) {
    return app.inject({
      method: 'POST',
      url: '/characters/preview',
      payload: {},
      headers: { cookie: `token=${makeToken(app, player)}` },
    });
  }

  it('answers 429 after the limit for one player while another still gets 200', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findByPlayer).mockResolvedValue([]);
    const app = await buildLimitedApp(characters);

    for (let call = 0; call < PREVIEW_LIMIT; call += 1) {
      expect((await preview(app, 'player-1')).statusCode).toBe(200);
    }
    const blocked = await preview(app, 'player-1');
    const otherPlayer = await preview(app, 'player-2');
    const otherEndpoint = await app.inject({
      method: 'GET',
      url: '/characters/mine',
      headers: { cookie: `token=${makeToken(app, 'player-1')}` },
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
    expect(otherPlayer.statusCode).toBe(200);
    expect(otherEndpoint.statusCode).toBe(200);
  });
});

describe('character write integrity contract', () => {
  async function patch(
    characters: CharacterRepository,
    payload: Record<string, unknown>,
  ) {
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    return app.inject({
      method: 'PATCH',
      url: '/characters/char-1',
      payload,
      headers: { cookie: `token=${makeToken(app)}` },
    });
  }

  it('returns 409 CONFLICT when the version is stale', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.updateSheet).mockRejectedValue(
      new CharacterVersionConflictError(),
    );

    const res = await patch(characters, { version: 0, nickname: 'X' });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('updates with the matching version and returns the next one', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.updateSheet).mockResolvedValue(
      makeCharacter({ version: 4 }),
    );

    const res = await patch(characters, { version: 3, nickname: 'X' });

    expect(res.statusCode).toBe(200);
    expect(res.json().character.version).toBe(4);
    expect(characters.updateSheet).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'char-1', expectedVersion: 3 }),
    );
  });

  it('rejects an update without version', async () => {
    const characters = makeCharacterRepository();

    const res = await patch(characters, { nickname: 'X' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
    expect(characters.updateSheet).not.toHaveBeenCalled();
  });

  it('rejects a create without clientRequestId', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    const app = await buildTestApp(makeServices(characters, membership));
    const payload = { ...createPayload(), clientRequestId: undefined };

    const res = await app.inject({
      method: 'POST',
      url: '/characters',
      payload,
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
    expect(characters.create).not.toHaveBeenCalled();
  });

  it('rejects a create with a malformed clientRequestId', async () => {
    const characters = makeCharacterRepository();
    const app = await buildTestApp(makeServices(characters, makeMembership()));

    const res = await app.inject({
      method: 'POST',
      url: '/characters',
      payload: { ...createPayload(), clientRequestId: 'not-a-uuid' },
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('answers a replayed create with 201 and the stored character', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(
      makeCreateResult({
        character: makeCharacter({ id: 'first-char' }),
        created: false,
      }),
    );
    const app = await buildTestApp(makeServices(characters, membership));

    const res = await app.inject({
      method: 'POST',
      url: '/characters',
      payload: createPayload(),
      headers: { cookie: `token=${makeToken(app)}` },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().character.id).toBe('first-char');
  });
});
