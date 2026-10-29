import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import websocketPlugin from '../../plugins/websocket.plugin.js';
import { InMemoryMessageBus } from './chat.bus.js';
import chatGateway from './chat.gateway.js';
import {
  fixedRng,
  makeCharacterAccess,
  makeChatMessages,
  makeCombat,
  makeCombatants,
  makeGameAccess,
  makePlayerDirectory,
} from './chat.testkit.js';
import { AddMonsterService } from './add-monster/add-monster.service.js';
import { CloseTestService } from './close-test/close-test.service.js';
import { ConnectService } from './connect/connect.service.js';
import { DeclareTestService } from './declare-test/declare-test.service.js';
import { EndCombatService } from './end-combat/end-combat.service.js';
import { ForceHpService } from './force-hp/force-hp.service.js';
import { LeaveService } from './leave/leave.service.js';
import { MasterBroadcastService } from './master-broadcast/master-broadcast.service.js';
import { MonsterAttackService } from './monster-attack/monster-attack.service.js';
import { NextTurnService } from './next-turn/next-turn.service.js';
import { RollDiceService } from './roll-dice/roll-dice.service.js';
import { RollInitiativeService } from './roll-initiative/roll-initiative.service.js';
import { RollMonsterTestService } from './roll-monster-test/roll-monster-test.service.js';
import { SendMessageService } from './send-message/send-message.service.js';
import { StartCombatService } from './start-combat/start-combat.service.js';
import { UpdateHpService } from './update-hp/update-hp.service.js';
import { UpdateMonsterVitalsService } from './update-monster-vitals/update-monster-vitals.service.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const TEST_ID = '22222222-2222-4222-8222-222222222222';
const MONSTER_ID = '33333333-3333-4333-8333-333333333333';

const GOBLIN = {
  id: MONSTER_ID,
  name: 'Goblin',
  attributes: {
    cognition: 2,
    psyche: -2,
    instinct: 0,
    constitution: 3,
    motricity: 1,
    perception: 0,
  },
  currentHp: 20,
  maxHp: 20,
  currentEffort: 10,
  maxEffort: 10,
  afflictions: [] as string[],
};

function monsterState(afflictions: string[]): CombatStatePayload {
  return {
    active: true,
    turnIndex: 0,
    round: 1,
    entries: [
      {
        combatantId: 'c-1',
        kind: 'monster',
        refId: MONSTER_ID,
        name: 'Goblin',
        initiativeValue: 7,
        hasRolled: true,
        currentHp: 20,
        maxHp: 20,
        currentEffort: 10,
        maxEffort: 10,
        afflictions,
        cognition: null,
        psyche: null,
        instinct: null,
        constitution: null,
        motricity: null,
        perception: null,
      },
    ],
  };
}

function buildServices(bus: InMemoryMessageBus) {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const characters = makeCharacterAccess();
  const players = makePlayerDirectory({ p1: 'Ana', 'master-1': 'Mestre' });
  const combatants = makeCombatants();
  const combat = makeCombat();
  const clock = () => new Date('2024-01-01T00:00:00.000Z');

  const services = {
    connect: new ConnectService(messages, access, players, bus, combat),
    sendMessage: new SendMessageService(messages, access, bus),
    rollDice: new RollDiceService(
      messages,
      access,
      characters,
      players,
      bus,
      fixedRng(10),
      combat,
    ),
    updateHp: new UpdateHpService(messages, access, characters, bus),
    forceHp: new ForceHpService(messages, access, characters, bus),
    masterBroadcast: new MasterBroadcastService(
      messages,
      access,
      players,
      bus,
      clock,
    ),
    leave: new LeaveService(messages, access, players, bus),
    startCombat: new StartCombatService(
      messages,
      access,
      combatants,
      combat,
      bus,
      fixedRng(10),
    ),
    rollInitiative: new RollInitiativeService(
      messages,
      access,
      combatants,
      combat,
      bus,
      fixedRng(10),
    ),
    nextTurn: new NextTurnService(messages, access, combat, bus),
    endCombat: new EndCombatService(messages, access, combat, bus),
    declareTest: new DeclareTestService(messages, access, combatants, bus),
    closeTest: new CloseTestService(messages, access, bus),
    rollMonsterTest: new RollMonsterTestService(
      messages,
      access,
      combat,
      bus,
      fixedRng(10),
    ),
    updateMonsterVitals: new UpdateMonsterVitalsService(
      messages,
      access,
      combat,
      bus,
    ),
    monsterAttack: new MonsterAttackService(
      messages,
      access,
      characters,
      combat,
      bus,
      fixedRng(10),
    ),
    addMonster: new AddMonsterService(
      messages,
      access,
      combatants,
      combat,
      bus,
    ),
  };

  return { services, messages, access, combatants, combat };
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(websocketPlugin);

  const bus = new InMemoryMessageBus();

  await app.register(chatGateway, {
    services: buildServices(bus).services,
    bus,
    verifyWsToken: () => null,
  });

  return app;
}

function openAndClose(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(
      () => reject(new Error('socket did not close in time')),
      2000,
    );

    socket.addEventListener('close', (event) => {
      clearTimeout(timeout);
      resolve(event.code);
    });
  });
}

async function listen(app: FastifyInstance): Promise<number> {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('test server has no port');
  }

  return address.port;
}

describe('chatGateway handshake', () => {
  const apps: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('closes with 4401 when the token is invalid', async () => {
    const app = await buildTestApp();
    apps.push(app);
    const port = await listen(app);

    const code = await openAndClose(`ws://127.0.0.1:${port}/ws?token=invalid`);

    expect(code).toBe(4401);
  });

  it('closes with 4401 when no token is presented', async () => {
    const app = await buildTestApp();
    apps.push(app);
    const port = await listen(app);

    const code = await openAndClose(`ws://127.0.0.1:${port}/ws`);

    expect(code).toBe(4401);
  });
});

const PRESENCE_FRAMES = new Set([
  'session.player-joined',
  'presence',
  'session.state',
]);

type Frame = { type: string; [key: string]: unknown };

function collectFrames(url: string): {
  frames: Frame[];
  send: (frame: object) => void;
  waitFor: (count: number) => Promise<void>;
  close: () => void;
} {
  const socket = new WebSocket(url);
  const frames: Frame[] = [];
  socket.addEventListener('message', (event) => {
    const frame = JSON.parse(String(event.data)) as Frame;
    if (!PRESENCE_FRAMES.has(frame.type)) frames.push(frame);
  });
  const opened = new Promise<void>((resolve) => {
    socket.addEventListener('open', () => resolve());
  });

  return {
    frames,
    send: (frame) => {
      opened.then(() => socket.send(JSON.stringify(frame)));
    },
    waitFor: (count) =>
      vi.waitFor(() => {
        if (frames.length < count) throw new Error('frames pending');
      }),
    close: () => socket.close(),
  };
}

describe('chatGateway session state', () => {
  const apps: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildJoinedApp() {
    const app = Fastify();
    await app.register(websocketPlugin);
    const bus = new InMemoryMessageBus();
    const built = buildServices(bus);
    apps.push(app);
    await app.register(chatGateway, {
      services: built.services,
      bus,
      verifyWsToken: (token) => token,
    });

    vi.mocked(built.messages.findSession).mockResolvedValue({
      id: SESSION_ID,
      gameId: 'game-1',
    });
    vi.mocked(built.messages.listRecentChat).mockResolvedValue([]);
    vi.mocked(built.messages.findLatestTest).mockResolvedValue(null);
    vi.mocked(built.messages.isTestClosed).mockResolvedValue(false);
    vi.mocked(built.access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(built.access.isMember).mockResolvedValue(true);
    vi.mocked(built.combat.findState).mockResolvedValue(null);
    const port = await listen(app);

    return { ...built, url: `ws://127.0.0.1:${port}/ws` };
  }

  it('sends history, then the test snapshot, then the combat state on join', async () => {
    const { url, messages, combat } = await buildJoinedApp();
    vi.mocked(messages.findLatestTest).mockResolvedValue({
      testId: TEST_ID,
      skillId: 'skill-1',
      cd: 15,
      mode: 'open',
      targetCharacterId: null,
      targetName: null,
    });
    vi.mocked(messages.listTestRollers).mockResolvedValue(['char-1']);
    vi.mocked(combat.findState).mockResolvedValue({
      active: true,
      turnIndex: 0,
      round: 1,
      entries: [],
    });
    const client = collectFrames(`${url}?token=p1`);

    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(3);
    client.close();

    const types = client.frames.map((frame) => frame.type);
    expect(types.slice(0, 3)).toEqual([
      'chat.history',
      'session.test-snapshot',
      'session.combat',
    ]);
    expect(client.frames[1]).toMatchObject({
      test: { testId: TEST_ID, rolledCharacterIds: ['char-1'] },
    });
  });

  it('sends a null test snapshot and an inactive combat frame when nothing is open', async () => {
    const { url } = await buildJoinedApp();
    const client = collectFrames(`${url}?token=p1`);

    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(3);
    client.close();

    expect(client.frames[1]).toEqual({
      type: 'session.test-snapshot',
      test: null,
    });
    expect(client.frames[2]).toEqual({
      type: 'session.combat',
      active: false,
      turnIndex: 0,
      round: 1,
      entries: [],
    });
  });

  it('dispatches master.close-test and broadcasts session.test-closed', async () => {
    const { url, messages } = await buildJoinedApp();
    vi.mocked(messages.findTestById).mockResolvedValue({
      testId: TEST_ID,
      skillId: 'skill-1',
      cd: 15,
      mode: 'open',
      targetCharacterId: null,
      targetName: null,
    });
    const client = collectFrames(`${url}?token=master-1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(2);

    client.send({
      type: 'master.close-test',
      sessionId: SESSION_ID,
      testId: TEST_ID,
    });
    await vi.waitFor(() => {
      const closed = client.frames.some(
        (frame) => frame.type === 'session.test-closed',
      );
      if (!closed) throw new Error('not closed yet');
    });
    client.close();

    expect(messages.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'test_closed' }),
    );
  });

  it('dispatches master.add-monster and broadcasts the combat state', async () => {
    const { url, combatants, combat } = await buildJoinedApp();
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue({
      id: MONSTER_ID,
      name: 'Goblin',
      attributes: {
        cognition: 2,
        psyche: -2,
        instinct: 0,
        constitution: 3,
        motricity: 1,
        perception: 0,
      },
      currentHp: 20,
      maxHp: 20,
      currentEffort: 10,
      maxEffort: 10,
      afflictions: ['fobia'],
    });
    vi.mocked(combat.addCombatant).mockResolvedValue({
      active: true,
      turnIndex: 0,
      round: 1,
      entries: [
        {
          combatantId: 'c-1',
          kind: 'monster',
          refId: MONSTER_ID,
          name: 'Goblin',
          initiativeValue: 7,
          hasRolled: true,
          currentHp: 20,
          maxHp: 20,
          currentEffort: 10,
          maxEffort: 10,
          afflictions: ['fobia'],
          cognition: 2,
          psyche: -2,
          instinct: 0,
          constitution: 3,
          motricity: 1,
          perception: 0,
        },
      ],
    });
    const client = collectFrames(`${url}?token=master-1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(3);
    vi.mocked(combat.findState).mockResolvedValue({
      active: true,
      turnIndex: 0,
      round: 1,
      entries: [],
    });

    client.send({
      type: 'master.add-monster',
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
    });
    await vi.waitFor(() => {
      const broadcast = client.frames
        .slice(3)
        .some((frame) => frame.type === 'session.combat');
      if (!broadcast) throw new Error('not broadcast yet');
    });
    client.close();

    expect(combat.addCombatant).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kind: 'monster', refId: MONSTER_ID }),
      'master-1',
    );
  });

  it('persists and broadcasts the afflictions sent with master.monster-vitals-update', async () => {
    const { url, combat, combatants } = await buildJoinedApp();
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue(GOBLIN);
    const client = collectFrames(`${url}?token=master-1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(2);
    vi.mocked(combat.findState).mockResolvedValue(monsterState([]));

    client.send({
      type: 'master.monster-vitals-update',
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
      currentHp: 15,
      currentEffort: 8,
      afflictions: ['fobia', 'vicio'],
    });
    await vi.waitFor(() => {
      const published = client.frames.some(
        (frame) => frame.type === 'session.monster-vitals',
      );
      if (!published) throw new Error('not published yet');
    });
    client.close();

    expect(combat.saveInstanceVitals).toHaveBeenCalledWith(
      SESSION_ID,
      MONSTER_ID,
      {
        currentHp: 15,
        currentEffort: 8,
        afflictions: ['fobia', 'vicio'],
      },
      'master-1',
    );
    expect(
      client.frames.find((frame) => frame.type === 'session.monster-vitals'),
    ).toMatchObject({ afflictions: ['fobia', 'vicio'] });
  });

  it('keeps the instance afflictions when master.monster-vitals-update omits them', async () => {
    const { url, combat, combatants } = await buildJoinedApp();
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue(GOBLIN);
    const client = collectFrames(`${url}?token=master-1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(2);
    vi.mocked(combat.findState).mockResolvedValue(monsterState(['fobia']));

    client.send({
      type: 'master.monster-vitals-update',
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
      currentHp: 15,
      currentEffort: 8,
    });
    await vi.waitFor(() => {
      const published = client.frames.some(
        (frame) => frame.type === 'session.monster-vitals',
      );
      if (!published) throw new Error('not published yet');
    });
    client.close();

    expect(combat.saveInstanceVitals).toHaveBeenCalledWith(
      SESSION_ID,
      MONSTER_ID,
      { currentHp: 15, currentEffort: 8 },
      'master-1',
    );
    expect(
      client.frames.find((frame) => frame.type === 'session.monster-vitals'),
    ).toMatchObject({ afflictions: ['fobia'] });
  });
});
