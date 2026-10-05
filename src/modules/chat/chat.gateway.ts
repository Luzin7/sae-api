import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import {
  WS_HEARTBEAT_INTERVAL_MS,
  WS_MAX_FRAME_BYTES,
  WS_RATE_MAX_FRAMES,
  WS_RATE_WINDOW_MS,
} from '@infra/ws/config.js';
import type { InMemoryMessageBus } from './chat.bus.js';
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
import type { ConnectService } from './connect/connect.service.js';
import type { ForceHpService } from './force-hp/force-hp.service.js';
import type { LeaveService } from './leave/leave.service.js';
import type { MasterBroadcastService } from './master-broadcast/master-broadcast.service.js';
import type { RollDiceService } from './roll-dice/roll-dice.service.js';
import type { SendMessageService } from './send-message/send-message.service.js';
import type { SetInitiativeService } from './set-initiative/set-initiative.service.js';
import type { UpdateHpService } from './update-hp/update-hp.service.js';

export interface ChatServices {
  connect: ConnectService;
  sendMessage: SendMessageService;
  rollDice: RollDiceService;
  updateHp: UpdateHpService;
  forceHp: ForceHpService;
  masterBroadcast: MasterBroadcastService;
  setInitiative: SetInitiativeService;
  leave: LeaveService;
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
      const { history } = await opts.services.connect.execute({
        playerId: state.playerId,
        socketId: state.socketId,
        sessionId: frame.sessionId,
      });
      state.rooms.add(frame.sessionId);
      sendEvent(socket, {
        type: 'chat.history',
        messages: toWireMessages(history),
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
      });
      return;
    }

    if (frame.type === 'character.hp-update') {
      await opts.services.updateHp.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        characterId: frame.characterId,
        newHp: frame.newHp,
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

    if (frame.type === 'master.set-initiative') {
      await opts.services.setInitiative.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        order: frame.order,
      });
      return;
    }

    if (frame.type === 'master.force-hp-update') {
      await opts.services.forceHp.execute({
        playerId: state.playerId,
        sessionId: frame.sessionId,
        characterId: frame.characterId,
        newHp: frame.newHp,
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
