import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import {
  WS_HEARTBEAT_INTERVAL_MS,
  WS_MAX_FRAME_BYTES,
  WS_RATE_MAX_FRAMES,
  WS_RATE_WINDOW_MS,
} from '@infra/ws/config.js';
import type { InMemoryMessageBus } from './chat.bus.js';
import { INACTIVE_COMBAT_STATE } from './chat.entity.js';
import { type InboundFrame } from './chat.schemas.js';
import {
  parseFrame,
  rawByteLength,
  sendDomainError,
  sendError,
  sendEvent,
  sinkFor,
  toWireMessages,
} from './chat.transport.js';
import type { AddMonsterService } from './add-monster/add-monster.service.js';
import type { SetMonsterAfflictionsService } from './set-monster-afflictions/set-monster-afflictions.service.js';
import type { ChangeHpService } from './change-hp/change-hp.service.js';
import type { ChangeMonsterHpService } from './change-monster-hp/change-monster-hp.service.js';
import type { ChangeEffortService } from './change-effort/change-effort.service.js';
import type { ChangeMonsterEffortService } from './change-monster-effort/change-monster-effort.service.js';
import type { CloseTestService } from './close-test/close-test.service.js';
import type { ConnectService } from './connect/connect.service.js';
import type { DeclareTestService } from './declare-test/declare-test.service.js';
import type { EndCombatService } from './end-combat/end-combat.service.js';
import type { LeaveService } from './leave/leave.service.js';
import type { MasterBroadcastService } from './master-broadcast/master-broadcast.service.js';
import type { MonsterAttackService } from './monster-attack/monster-attack.service.js';
import type { NextTurnService } from './next-turn/next-turn.service.js';
import type { RollDiceService } from './roll-dice/roll-dice.service.js';
import type { RollInitiativeService } from './roll-initiative/roll-initiative.service.js';
import type { RollMonsterTestService } from './roll-monster-test/roll-monster-test.service.js';
import type { SendMessageService } from './send-message/send-message.service.js';
import type { StartCombatService } from './start-combat/start-combat.service.js';

export interface ChatServices {
  connect: ConnectService;
  sendMessage: SendMessageService;
  rollDice: RollDiceService;
  changeHp: ChangeHpService;
  changeMonsterHp: ChangeMonsterHpService;
  setMonsterAfflictions: SetMonsterAfflictionsService;
  changeEffort: ChangeEffortService;
  changeMonsterEffort: ChangeMonsterEffortService;
  masterBroadcast: MasterBroadcastService;
  leave: LeaveService;
  startCombat: StartCombatService;
  rollInitiative: RollInitiativeService;
  nextTurn: NextTurnService;
  endCombat: EndCombatService;
  declareTest: DeclareTestService;
  closeTest: CloseTestService;
  rollMonsterTest: RollMonsterTestService;
  monsterAttack: MonsterAttackService;
  addMonster: AddMonsterService;
}

export interface ChatGatewayOptions {
  services: ChatServices;
  bus: InMemoryMessageBus;
  verifyWsToken: (token: string) => string | null;
}

interface SocketState {
  playerId: string;
  socketId: string;
  alive: boolean;
  frameTimes: number[];
  rooms: Set<string>;
}

interface WsQuery {
  token?: string;
}

export default async function chatGateway(
  app: FastifyInstance,
  opts: ChatGatewayOptions,
) {
  app.get<{ Querystring: WsQuery }>(
    '/ws',
    { websocket: true },
    (socket, request) => {
      const token = request.query.token;
      const playerId = token ? opts.verifyWsToken(token) : null;
      if (!playerId) {
        socket.close(4401, 'Unauthorized');
        return;
      }

      handleConnection(socket, playerId, request.id, opts);
    },
  );
}

function handleConnection(
  socket: WebSocket,
  playerId: string,
  socketId: string,
  opts: ChatGatewayOptions,
): void {
  const state: SocketState = {
    playerId,
    socketId,
    alive: true,
    frameTimes: [],
    rooms: new Set<string>(),
  };

  opts.bus.register(socketId, playerId, sinkFor(socket));

  const heartbeat = setInterval(() => {
    if (!state.alive) {
      socket.terminate();
      return;
    }

    state.alive = false;
    socket.ping();
  }, WS_HEARTBEAT_INTERVAL_MS);

  socket.on('pong', () => {
    state.alive = true;
  });
  socket.on('message', (data) => {
    handleMessage(socket, state, data, opts).catch(() => undefined);
  });
  socket.on('close', () => {
    clearInterval(heartbeat);
    leaveAll(state, opts).catch(() => undefined);
  });
}

async function leaveAll(
  state: SocketState,
  opts: ChatGatewayOptions,
): Promise<void> {
  for (const sessionId of state.rooms) {
    try {
      await opts.services.leave.execute({
        playerId: state.playerId,
        socketId: state.socketId,
        sessionId,
      });
    } catch {
      // Disconnect cleanup is best-effort; a dead socket must not crash.
    }
  }

  opts.bus.unregister(state.socketId);
}

async function handleMessage(
  socket: WebSocket,
  state: SocketState,
  data: RawData,
  opts: ChatGatewayOptions,
): Promise<void> {
  if (rawByteLength(data) > WS_MAX_FRAME_BYTES) {
    sendError(socket, 'VALIDATION', 'Frame maior que o permitido.');
    return;
  }

  if (!withinRateLimit(state)) {
    sendError(socket, 'TOO_MANY_REQUESTS', 'Muitas mensagens em pouco tempo.');
    return;
  }

  const frame = parseFrame(data);
  if (!frame) {
    sendError(socket, 'VALIDATION', 'Frame inválido.');
    return;
  }

  await dispatch(socket, state, frame, opts);
}

async function dispatch(
  socket: WebSocket,
  state: SocketState,
  frame: InboundFrame,
  opts: ChatGatewayOptions,
): Promise<void> {
  try {
    if (frame.type === 'ping') {
      sendEvent(socket, { type: 'pong' });
      return;
    }

    if (frame.type === 'session.join') {
      const { history, openTest, combat } = await opts.services.connect.execute(
        {
          playerId: state.playerId,
          socketId: state.socketId,
          sessionId: frame.sessionId,
        },
      );
      state.rooms.add(frame.sessionId);
      sendEvent(socket, {
        type: 'chat.history',
        messages: toWireMessages(history),
      });
      sendEvent(socket, { type: 'session.test-snapshot', test: openTest });
      sendEvent(socket, {
        type: 'session.combat',
        ...(combat ?? INACTIVE_COMBAT_STATE),
      });
      return;
    }

    if (frame.type === 'chat.send') {
      await opts.services.sendMessage.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        body: frame.body,
      });
      return;
    }

    if (frame.type === 'dice.roll') {
      await opts.services.rollDice.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        characterId: frame.characterId,
        skillId: frame.skillId,
        testId: frame.testId,
      });
      return;
    }

    if (frame.type === 'character.hp-change') {
      await opts.services.changeHp.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        characterId: frame.characterId,
        delta: frame.delta,
      });
      return;
    }

    if (frame.type === 'character.pe-change') {
      await opts.services.changeEffort.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        characterId: frame.characterId,
        delta: frame.delta,
      });
      return;
    }

    if (frame.type === 'master.broadcast') {
      await opts.services.masterBroadcast.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        text: frame.text,
      });
      return;
    }

    if (frame.type === 'master.start-combat') {
      await opts.services.startCombat.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
      });
      return;
    }

    if (frame.type === 'combat.roll-initiative') {
      await opts.services.rollInitiative.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        kind: frame.kind,
        refId: frame.refId,
      });
      return;
    }

    if (frame.type === 'master.next-turn') {
      await opts.services.nextTurn.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        expectedTurnIndex: frame.expectedTurnIndex,
        expectedRound: frame.expectedRound,
      });
      return;
    }

    if (frame.type === 'master.end-combat') {
      await opts.services.endCombat.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
      });
      return;
    }

    if (frame.type === 'master.declare-test') {
      await opts.services.declareTest.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        skillId: frame.skillId,
        grade: frame.grade,
        mode: frame.mode,
        targetCharacterId: frame.targetCharacterId ?? null,
      });
      return;
    }

    if (frame.type === 'master.close-test') {
      await opts.services.closeTest.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        testId: frame.testId,
      });
      return;
    }

    if (frame.type === 'master.roll-monster-test') {
      await opts.services.rollMonsterTest.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        monsterId: frame.monsterId,
        attribute: frame.attribute,
      });
      return;
    }

    if (frame.type === 'master.monster-hp-change') {
      await opts.services.changeMonsterHp.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        monsterId: frame.monsterId,
        delta: frame.delta,
      });
      return;
    }

    if (frame.type === 'master.monster-afflictions-update') {
      await opts.services.setMonsterAfflictions.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        monsterId: frame.monsterId,
        afflictions: frame.afflictions,
      });
      return;
    }

    if (frame.type === 'master.monster-pe-change') {
      await opts.services.changeMonsterEffort.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        monsterId: frame.monsterId,
        delta: frame.delta,
      });
      return;
    }

    if (frame.type === 'master.add-monster') {
      await opts.services.addMonster.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        monsterId: frame.monsterId,
      });
      return;
    }

    if (frame.type === 'master.monster-attack') {
      await opts.services.monsterAttack.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        monsterId: frame.monsterId,
        attribute: frame.attribute,
        targetCharacterId: frame.targetCharacterId,
        damage: frame.damage,
      });
    }
  } catch (error) {
    sendDomainError(socket, error);
  }
}

function withinRateLimit(state: SocketState): boolean {
  const now = Date.now();
  const recent = state.frameTimes.filter((at) => now - at < WS_RATE_WINDOW_MS);
  state.frameTimes = recent;

  if (recent.length >= WS_RATE_MAX_FRAMES) return false;

  state.frameTimes.push(now);
  return true;
}
