import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
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

function buildServices(bus: InMemoryMessageBus) {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const characters = makeCharacterAccess();
  const players = makePlayerDirectory();
  const combatants = makeCombatants();
  const combat = makeCombat();
  const clock = () => new Date('2024-01-01T00:00:00.000Z');

  return {
    connect: new ConnectService(messages, access, players, bus),
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
    rollMonsterTest: new RollMonsterTestService(
      messages,
      access,
      combatants,
      combat,
      bus,
      fixedRng(10),
    ),
    updateMonsterVitals: new UpdateMonsterVitalsService(
      messages,
      access,
      combatants,
      combat,
      bus,
    ),
    monsterAttack: new MonsterAttackService(
      messages,
      access,
      characters,
      combatants,
      combat,
      bus,
      fixedRng(10),
    ),
  };
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(websocketPlugin);

  const bus = new InMemoryMessageBus();

  await app.register(chatGateway, {
    services: buildServices(bus),
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
