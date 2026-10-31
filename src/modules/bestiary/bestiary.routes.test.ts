import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import authPlugin from '../../plugins/auth.plugin.js';
import { registerErrorHandler } from '@infra/http/error-handler.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { Monster } from './bestiary.entity.js';
import type { MonsterRepository } from './bestiary.repository.js';
import bestiaryRoutes from './bestiary.routes.js';
import { CreateMonsterService } from './create-monster/create-monster.service.js';
import { DeleteMonsterService } from './delete-monster/delete-monster.service.js';
import { MonsterQueryService } from './monster-query.service.js';
import { UpdateMonsterService } from './update-monster/update-monster.service.js';

process.env.JWT_SECRET = 'test-secret-key-for-tests-only';

const MASTER_A = 'master-a';
const MASTER_B = 'master-b';
const GAME_A = '11111111-1111-4111-8111-111111111111';
const GAME_A2 = '22222222-2222-4222-8222-222222222222';
const GAME_B = '33333333-3333-4333-8333-333333333333';

const CLIENT_REQUEST_ID = '44444444-4444-4444-8444-444444444444';

const CREATED_AT = new Date('2024-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2024-01-01T00:00:00.000Z');

function makeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: 'monster-1',
    gameId: GAME_A,
    name: 'Goblin',
    np: 1,
    maxHp: 10,
    currentHp: 10,
    maxEffort: 5,
    size: null,
    cognition: -5,
    psyche: -5,
    instinct: -5,
    constitution: -5,
    motricity: -5,
    perception: -5,
    heightCm: null,
    weightKg: null,
    notes: null,
    createdBy: MASTER_A,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function makeGameAccess(): GameAccess {
  const masters: Record<string, string> = {
    [GAME_A]: MASTER_A,
    [GAME_A2]: MASTER_A,
    [GAME_B]: MASTER_B,
  };

  return {
    findById: vi.fn(async (gameId: string) => {
      const masterId = masters[gameId];
      if (!masterId) return null;

      return { id: gameId, masterId };
    }),
    isMember: vi.fn(async () => true),
    mastersAnyGame: vi.fn(async (playerId: string) =>
      Object.values(masters).includes(playerId),
    ),
  };
}

interface FakeMonsterRepository extends MonsterRepository {
  findReusableByOwner(ownerId: string): Promise<Monster[]>;
}

function makeMonsters(seed: Monster[] = []): FakeMonsterRepository {
  const rows = new Map(seed.map((item) => [item.id, item]));
  let counter = 0;
  const requestIds = new Map<string, string>();

  return {
    async create(input) {
      const replayed = [...rows.values()].find(
        (item) =>
          item.createdBy === input.createdBy &&
          requestIds.get(item.id) === input.clientRequestId,
      );
      if (replayed) return replayed;

      counter += 1;
      const monster = makeMonster({
        id: `monster-${counter}`,
        gameId: input.gameId ?? null,
        name: input.name,
        np: input.np,
        maxHp: input.maxHp,
        currentHp: input.currentHp ?? input.maxHp,
        maxEffort: input.maxEffort,
        createdBy: input.createdBy,
      });
      rows.set(monster.id, monster);
      requestIds.set(monster.id, input.clientRequestId);

      return monster;
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async findByGame(gameId) {
      return [...rows.values()].filter((item) => item.gameId === gameId);
    },
    async findReusableByOwner(ownerId) {
      return [...rows.values()].filter(
        (item) => item.gameId === null && item.createdBy === ownerId,
      );
    },
    async save(id, patch) {
      const current = rows.get(id);
      if (!current) throw new Error('missing monster');

      const next = { ...current, ...patch, updatedAt: new Date(UPDATED_AT) };
      rows.set(id, next);

      return next;
    },
    async delete(id) {
      rows.delete(id);
    },
  };
}

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: CLIENT_REQUEST_ID,
    name: 'Goblin',
    np: 1,
    maxHp: 10,
    maxEffort: 5,
    ...overrides,
  };
}

async function buildTestApp(
  monsters: FakeMonsterRepository,
  gameAccess: GameAccess = makeGameAccess(),
) {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  registerErrorHandler(app);
  await app.register(bestiaryRoutes, {
    prefix: '/bestiary',
    services: {
      createMonster: new CreateMonsterService(monsters, gameAccess),
      updateMonster: new UpdateMonsterService(monsters, gameAccess),
      deleteMonster: new DeleteMonsterService(monsters, gameAccess),
      query: new MonsterQueryService(monsters, gameAccess),
    },
  });

  return app;
}

function makeToken(
  app: Awaited<ReturnType<typeof buildTestApp>>,
  playerId: string,
) {
  return app.jwt.sign({ sub: playerId, name: 'Tester' });
}

function names(res: { json(): { monsters: { name: string }[] } }): string[] {
  return res
    .json()
    .monsters.map((monster) => monster.name)
    .sort();
}

beforeEach(() => vi.clearAllMocks());

describe('bestiary routes', () => {
  it('requires authentication on the reusable list', async () => {
    const app = await buildTestApp(makeMonsters());

    const res = await app.inject({ method: 'GET', url: '/bestiary/mine' });

    expect(res.statusCode).toBe(401);
  });

  it('creates a reusable entry when gameId is absent', async () => {
    const gameAccess = makeGameAccess();
    const app = await buildTestApp(makeMonsters(), gameAccess);

    const res = await app.inject({
      method: 'POST',
      url: '/bestiary',
      payload: makeBody(),
      headers: { cookie: `token=${makeToken(app, MASTER_A)}` },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().monster.gameId).toBeNull();
    expect(res.json().monster.ownerId).toBe(MASTER_A);
    expect(res.json().monster.createdBy).toBe(MASTER_A);
    expect(gameAccess.mastersAnyGame).toHaveBeenCalledWith(MASTER_A);
  });

  it('creates one monster when the same clientRequestId is replayed', async () => {
    const monsters = makeMonsters();
    const app = await buildTestApp(monsters);
    const request = {
      method: 'POST' as const,
      url: '/bestiary',
      payload: makeBody(),
      headers: { cookie: `token=${makeToken(app, MASTER_A)}` },
    };

    const first = await app.inject(request);
    const replay = await app.inject(request);

    expect(replay.statusCode).toBe(201);
    expect(replay.json().monster.id).toBe(first.json().monster.id);
    await expect(monsters.findReusableByOwner(MASTER_A)).resolves.toHaveLength(
      1,
    );
  });

  it('rejects a create without clientRequestId', async () => {
    const monsters = makeMonsters();
    const create = vi.spyOn(monsters, 'create');
    const app = await buildTestApp(monsters);
    const payload = { ...makeBody(), clientRequestId: undefined };

    const res = await app.inject({
      method: 'POST',
      url: '/bestiary',
      payload,
      headers: { cookie: `token=${makeToken(app, MASTER_A)}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a create with a size outside the official keys', async () => {
    const monsters = makeMonsters();
    const create = vi.spyOn(monsters, 'create');
    const app = await buildTestApp(monsters);

    const res = await app.inject({
      method: 'POST',
      url: '/bestiary',
      payload: makeBody({ size: 'Gigantão' }),
      headers: { cookie: `token=${makeToken(app, MASTER_A)}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an update with a size outside the official keys', async () => {
    const app = await buildTestApp(makeMonsters([makeMonster()]));

    const res = await app.inject({
      method: 'PATCH',
      url: '/bestiary/monster-1',
      payload: { size: 'Médio' },
      headers: { cookie: `token=${makeToken(app, MASTER_A)}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
  });

  it('rejects a reusable entry from a user who masters no table', async () => {
    const monsters = makeMonsters();
    const create = vi.spyOn(monsters, 'create');
    const app = await buildTestApp(monsters);

    const res = await app.inject({
      method: 'POST',
      url: '/bestiary',
      payload: makeBody(),
      headers: { cookie: `token=${makeToken(app, 'player-1')}` },
    });

    expect(res.statusCode).toBe(403);
    expect(create).not.toHaveBeenCalled();
    await expect(monsters.findReusableByOwner('player-1')).resolves.toEqual([]);
  });

  it('lists the master reusable entries in every table they master', async () => {
    const app = await buildTestApp(
      makeMonsters([
        makeMonster({ id: 'reusable-1', gameId: null, name: 'Reusable' }),
        makeMonster({ id: 'table-1', gameId: GAME_A, name: 'Table A' }),
        makeMonster({ id: 'table-2', gameId: GAME_A2, name: 'Table A2' }),
      ]),
    );

    const first = await app.inject({
      method: 'GET',
      url: `/bestiary/game/${GAME_A}`,
      headers: { cookie: `token=${makeToken(app, MASTER_A)}` },
    });
    const second = await app.inject({
      method: 'GET',
      url: `/bestiary/game/${GAME_A2}`,
      headers: { cookie: `token=${makeToken(app, MASTER_A)}` },
    });

    expect(first.statusCode).toBe(200);
    expect(names(first)).toEqual(['Reusable', 'Table A']);
    expect(second.statusCode).toBe(200);
    expect(names(second)).toEqual(['Reusable', 'Table A2']);
  });

  it('hides another master reusable entry from the table list', async () => {
    const app = await buildTestApp(
      makeMonsters([
        makeMonster({ id: 'reusable-1', gameId: null, name: 'Reusable A' }),
        makeMonster({
          id: 'table-b',
          gameId: GAME_B,
          name: 'Table B',
          createdBy: MASTER_B,
        }),
      ]),
    );

    const res = await app.inject({
      method: 'GET',
      url: `/bestiary/game/${GAME_B}`,
      headers: { cookie: `token=${makeToken(app, MASTER_B)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(names(res)).toEqual(['Table B']);
  });

  it('returns only the caller reusable entries on the reusable list', async () => {
    const app = await buildTestApp(
      makeMonsters([
        makeMonster({ id: 'reusable-a', gameId: null, name: 'Reusable A' }),
        makeMonster({
          id: 'reusable-b',
          gameId: null,
          name: 'Reusable B',
          createdBy: MASTER_B,
        }),
        makeMonster({ id: 'table-a', gameId: GAME_A, name: 'Table A' }),
      ]),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/bestiary/mine',
      headers: { cookie: `token=${makeToken(app, MASTER_A)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(names(res)).toEqual(['Reusable A']);
  });

  it('lets the owner read, update and delete a reusable entry', async () => {
    const monsters = makeMonsters([
      makeMonster({ id: 'reusable-1', gameId: null, name: 'Reusable' }),
    ]);
    const app = await buildTestApp(monsters);
    const headers = { cookie: `token=${makeToken(app, MASTER_A)}` };

    const read = await app.inject({
      method: 'GET',
      url: '/bestiary/reusable-1',
      headers,
    });
    const updated = await app.inject({
      method: 'PATCH',
      url: '/bestiary/reusable-1',
      payload: { name: 'Renamed' },
      headers,
    });
    const deleted = await app.inject({
      method: 'DELETE',
      url: '/bestiary/reusable-1',
      headers,
    });

    expect(read.statusCode).toBe(200);
    expect(read.json().monster.gameId).toBeNull();
    expect(read.json().monster.ownerId).toBe(MASTER_A);
    expect(updated.statusCode).toBe(200);
    expect(updated.json().monster.name).toBe('Renamed');
    expect(deleted.statusCode).toBe(204);
  });

  it('forbids another user from reading a reusable entry', async () => {
    const app = await buildTestApp(
      makeMonsters([
        makeMonster({ id: 'reusable-1', gameId: null, name: 'Reusable' }),
      ]),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/bestiary/reusable-1',
      headers: { cookie: `token=${makeToken(app, MASTER_B)}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('forbids another user from updating a reusable entry', async () => {
    const monsters = makeMonsters([
      makeMonster({ id: 'reusable-1', gameId: null, name: 'Reusable' }),
    ]);
    const app = await buildTestApp(monsters);

    const res = await app.inject({
      method: 'PATCH',
      url: '/bestiary/reusable-1',
      payload: { name: 'Changed' },
      headers: { cookie: `token=${makeToken(app, MASTER_B)}` },
    });

    expect(res.statusCode).toBe(403);
    await expect(monsters.findById('reusable-1')).resolves.toEqual(
      expect.objectContaining({ name: 'Reusable' }),
    );
  });

  it('forbids another user from deleting a reusable entry', async () => {
    const monsters = makeMonsters([
      makeMonster({ id: 'reusable-1', gameId: null, name: 'Reusable' }),
    ]);
    const app = await buildTestApp(monsters);

    const res = await app.inject({
      method: 'DELETE',
      url: '/bestiary/reusable-1',
      headers: { cookie: `token=${makeToken(app, MASTER_B)}` },
    });

    expect(res.statusCode).toBe(403);
    await expect(monsters.findById('reusable-1')).resolves.toEqual(
      expect.objectContaining({ name: 'Reusable' }),
    );
  });

  it('keeps a table-only entry readable, updatable and deletable by its master', async () => {
    const monsters = makeMonsters([
      makeMonster({ id: 'table-1', gameId: GAME_A, name: 'Table A' }),
    ]);
    const app = await buildTestApp(monsters);
    const headers = { cookie: `token=${makeToken(app, MASTER_A)}` };

    const read = await app.inject({
      method: 'GET',
      url: '/bestiary/table-1',
      headers,
    });
    const updated = await app.inject({
      method: 'PATCH',
      url: '/bestiary/table-1',
      payload: { name: 'Renamed' },
      headers,
    });
    const deleted = await app.inject({
      method: 'DELETE',
      url: '/bestiary/table-1',
      headers,
    });

    expect(read.statusCode).toBe(200);
    expect(read.json().monster.gameId).toBe(GAME_A);
    expect(read.json().monster.ownerId).toBe(MASTER_A);
    expect(updated.statusCode).toBe(200);
    expect(updated.json().monster.name).toBe('Renamed');
    expect(deleted.statusCode).toBe(204);
  });

  it('keeps a table-only entry created with gameId scoped to that table', async () => {
    const app = await buildTestApp(makeMonsters());

    const res = await app.inject({
      method: 'POST',
      url: '/bestiary',
      payload: makeBody({ gameId: GAME_A }),
      headers: { cookie: `token=${makeToken(app, MASTER_A)}` },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().monster.gameId).toBe(GAME_A);
    expect(res.json().monster.ownerId).toBe(MASTER_A);
  });

  it('forbids another master from managing a table-only entry', async () => {
    const monsters = makeMonsters([
      makeMonster({ id: 'table-1', gameId: GAME_A, name: 'Table A' }),
    ]);
    const app = await buildTestApp(monsters);
    const headers = { cookie: `token=${makeToken(app, MASTER_B)}` };

    const read = await app.inject({
      method: 'GET',
      url: '/bestiary/table-1',
      headers,
    });
    const updated = await app.inject({
      method: 'PATCH',
      url: '/bestiary/table-1',
      payload: { name: 'Changed' },
      headers,
    });
    const deleted = await app.inject({
      method: 'DELETE',
      url: '/bestiary/table-1',
      headers,
    });

    expect(read.statusCode).toBe(403);
    expect(updated.statusCode).toBe(403);
    expect(deleted.statusCode).toBe(403);
  });

  it('returns 404 before 403 for a missing entry', async () => {
    const app = await buildTestApp(makeMonsters());

    const res = await app.inject({
      method: 'GET',
      url: '/bestiary/missing',
      headers: { cookie: `token=${makeToken(app, MASTER_B)}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
