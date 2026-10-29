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
import { SetMonsterAfflictionsService } from './set-monster-afflictions/set-monster-afflictions.service.js';
import { ChangeHpService } from './change-hp/change-hp.service.js';
import { ChangeMonsterHpService } from './change-monster-hp/change-monster-hp.service.js';
import { ChangeEffortService } from './change-effort/change-effort.service.js';
import { ChangeMonsterEffortService } from './change-monster-effort/change-monster-effort.service.js';
import { LeaveService } from './leave/leave.service.js';
import { MasterBroadcastService } from './master-broadcast/master-broadcast.service.js';
import { MonsterAttackService } from './monster-attack/monster-attack.service.js';
import { NextTurnService } from './next-turn/next-turn.service.js';
import { RollDiceService } from './roll-dice/roll-dice.service.js';
import { RollInitiativeService } from './roll-initiative/roll-initiative.service.js';
import { RollMonsterTestService } from './roll-monster-test/roll-monster-test.service.js';
import { SendMessageService } from './send-message/send-message.service.js';
import { StartCombatService } from './start-combat/start-combat.service.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const TEST_ID = '22222222-2222-4222-8222-222222222222';
const MONSTER_ID = '33333333-3333-4333-8333-333333333333';
const CHARACTER_ID = '44444444-4444-4444-8444-444444444444';

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
    changeHp: new ChangeHpService(messages, access, characters, bus),
    changeEffort: new ChangeEffortService(messages, access, characters, bus),
    changeMonsterEffort: new ChangeMonsterEffortService(
      messages,
      access,
      combat,
      bus,
    ),
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
    changeMonsterHp: new ChangeMonsterHpService(messages, access, combat, bus),
    setMonsterAfflictions: new SetMonsterAfflictionsService(
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

  return { services, messages, access, combatants, combat, characters };
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

  it('dispatches character.hp-change and broadcasts the PS change', async () => {
    const { url, characters } = await buildJoinedApp();
    vi.mocked(characters.findById).mockResolvedValue({
      id: CHARACTER_ID,
      gameId: 'game-1',
      playerId: 'p1',
      name: 'Hero',
      currentHp: 10,
      maxHp: 30,
      currentEffort: 0,
      maxEffort: 20,
      bExp: 0,
      attributes: {
        cognition: 0,
        psyche: 0,
        instinct: 0,
        constitution: 0,
        motricity: 0,
        perception: 0,
      },
    });
    vi.mocked(characters.changeHp).mockResolvedValue({ oldHp: 10, newHp: 15 });
    const client = collectFrames(`${url}?token=p1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(3);

    client.send({
      type: 'character.hp-change',
      sessionId: SESSION_ID,
      characterId: CHARACTER_ID,
      delta: 5,
    });
    await vi.waitFor(() => {
      if (!client.frames.some((f) => f.type === 'character.hp-changed')) {
        throw new Error('not broadcast yet');
      }
    });
    client.close();

    expect(characters.changeHp).toHaveBeenCalledWith(CHARACTER_ID, 5, {
      sessionId: SESSION_ID,
      playerId: 'p1',
    });
    expect(
      client.frames.find((frame) => frame.type === 'character.hp-changed'),
    ).toEqual({
      type: 'character.hp-changed',
      characterId: CHARACTER_ID,
      oldHp: 10,
      newHp: 15,
    });
  });

  it('answers an error to the removed absolute frames', async () => {
    const { url, characters, combat } = await buildJoinedApp();
    const client = collectFrames(`${url}?token=master-1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(3);

    client.send({
      type: 'master.monster-vitals-update',
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
      currentHp: 5,
    });
    await vi.waitFor(() => {
      if (!client.frames.some((f) => f.type === 'error')) {
        throw new Error('no error yet');
      }
    });
    client.close();

    expect(combat.changeInstanceHp).not.toHaveBeenCalled();
    expect(characters.changeHp).not.toHaveBeenCalled();
  });

  it('dispatches master.monster-afflictions-update and broadcasts the combat state', async () => {
    const { url, combat } = await buildJoinedApp();
    vi.mocked(combat.setInstanceAfflictions).mockResolvedValue({
      state: { active: true, turnIndex: 0, round: 1, entries: [] },
    });
    const client = collectFrames(`${url}?token=master-1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(3);

    client.send({
      type: 'master.monster-afflictions-update',
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
      afflictions: ['fobia'],
    });
    await vi.waitFor(() => {
      if (!client.frames.slice(3).some((f) => f.type === 'session.combat')) {
        throw new Error('not broadcast yet');
      }
    });
    client.close();

    expect(combat.setInstanceAfflictions).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
      afflictions: ['fobia'],
      playerId: 'master-1',
    });
  });

  it('dispatches master.monster-hp-change and broadcasts the combat state', async () => {
    const { url, combat } = await buildJoinedApp();
    vi.mocked(combat.changeInstanceHp).mockResolvedValue({
      state: { active: true, turnIndex: 0, round: 1, entries: [] },
      oldHp: 10,
      newHp: 7,
    });
    const client = collectFrames(`${url}?token=master-1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(3);

    client.send({
      type: 'master.monster-hp-change',
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
      delta: -3,
    });
    await vi.waitFor(() => {
      if (!client.frames.slice(3).some((f) => f.type === 'session.combat')) {
        throw new Error('not broadcast yet');
      }
    });
    client.close();

    expect(combat.changeInstanceHp).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
      delta: -3,
      playerId: 'master-1',
    });
  });

  it('dispatches character.pe-change and broadcasts pe and hp changes', async () => {
    const { url, characters } = await buildJoinedApp();
    vi.mocked(characters.findById).mockResolvedValue({
      id: CHARACTER_ID,
      gameId: 'game-1',
      playerId: 'p1',
      name: 'Hero',
      currentHp: 30,
      maxHp: 40,
      currentEffort: 18,
      maxEffort: 20,
      bExp: 0,
      attributes: {
        cognition: 0,
        psyche: 0,
        instinct: 0,
        constitution: 0,
        motricity: 0,
        perception: 0,
      },
    });
    vi.mocked(characters.changeEffort).mockResolvedValue({
      oldEffort: 18,
      newEffort: 20,
      oldHp: 30,
      newHp: 27,
    });
    const client = collectFrames(`${url}?token=p1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(3);

    client.send({
      type: 'character.pe-change',
      sessionId: SESSION_ID,
      characterId: CHARACTER_ID,
      delta: 5,
    });
    await vi.waitFor(() => {
      if (!client.frames.some((f) => f.type === 'character.hp-changed')) {
        throw new Error('not broadcast yet');
      }
    });
    client.close();

    expect(characters.changeEffort).toHaveBeenCalledWith(CHARACTER_ID, 5, {
      sessionId: SESSION_ID,
      playerId: 'p1',
    });
    expect(
      client.frames.find((frame) => frame.type === 'character.pe-changed'),
    ).toEqual({
      type: 'character.pe-changed',
      characterId: CHARACTER_ID,
      oldPe: 18,
      newPe: 20,
    });
  });

  it('rejects a character.pe-change with delta 0 before any service runs', async () => {
    const { url, characters } = await buildJoinedApp();
    const client = collectFrames(`${url}?token=p1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(3);

    client.send({
      type: 'character.pe-change',
      sessionId: SESSION_ID,
      characterId: CHARACTER_ID,
      delta: 0,
    });
    await vi.waitFor(() => {
      if (!client.frames.some((f) => f.type === 'error')) {
        throw new Error('no error yet');
      }
    });
    client.close();

    expect(characters.changeEffort).not.toHaveBeenCalled();
  });

  it('dispatches master.monster-pe-change and broadcasts the combat state', async () => {
    const { url, combat } = await buildJoinedApp();
    vi.mocked(combat.changeInstanceEffort).mockResolvedValue({
      state: { active: true, turnIndex: 0, round: 1, entries: [] },
      oldEffort: 0,
      newEffort: 2,
      oldHp: 10,
      newHp: 10,
    });
    const client = collectFrames(`${url}?token=master-1`);
    client.send({ type: 'session.join', sessionId: SESSION_ID });
    await client.waitFor(3);

    client.send({
      type: 'master.monster-pe-change',
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
      delta: 2,
    });
    await vi.waitFor(() => {
      if (!client.frames.slice(3).some((f) => f.type === 'session.combat')) {
        throw new Error('not broadcast yet');
      }
    });
    client.close();

    expect(combat.changeInstanceEffort).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
      delta: 2,
      playerId: 'master-1',
    });
  });
});
