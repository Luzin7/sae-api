import type { RawData, WebSocket } from 'ws';
import { ZodError } from 'zod';
import { DomainError } from '@shared/errors/domain-error.js';
import type { ChatMessage, RealtimeEvent } from './chat.entity.js';
import {
  type ChatMessageWire,
  type InboundFrame,
  InboundFrameSchema,
  type OutboundEvent,
  OutboundEventSchema,
} from './chat.schemas.js';

/** Frame parsing + outbound encoding. Pure transport helpers, no business rules. */
export function parseFrame(data: RawData): InboundFrame | null {
  const text = rawToText(data);
  if (text === null) return null;

  const json = parseJson(text);
  if (json === null) return null;

  const result = InboundFrameSchema.safeParse(json);
  if (!result.success) return null;

  return result.data;
}

export function rawByteLength(data: RawData): number {
  if (typeof data === 'string') return Buffer.byteLength(data);
  if (Buffer.isBuffer(data)) return data.byteLength;
  if (data instanceof ArrayBuffer) return data.byteLength;

  return data.reduce((total, chunk) => total + chunk.byteLength, 0);
}

export function sendEvent(socket: WebSocket, event: OutboundEvent): void {
  const result = OutboundEventSchema.safeParse(event);
  if (!result.success) return;

  socket.send(JSON.stringify(result.data));
}

export function sendError(
  socket: WebSocket,
  code: string,
  message: string,
): void {
  sendEvent(socket, { type: 'error', error: { code, message } });
}

export function sendDomainError(socket: WebSocket, error: unknown): void {
  if (error instanceof DomainError) {
    sendError(socket, error.code, error.message);
    return;
  }

  if (error instanceof ZodError) {
    sendError(socket, 'VALIDATION', 'Dados inválidos.');
    return;
  }

  sendError(socket, 'INTERNAL', 'Erro interno do servidor.');
}

export function sinkFor(socket: WebSocket): (event: RealtimeEvent) => void {
  return (event) => sendEvent(socket, toOutbound(event));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function rawToText(data: RawData): string | null {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');

  return null;
}

function toWireMessage(message: ChatMessage): ChatMessageWire {
  return {
    id: message.id,
    sessionId: message.sessionId,
    playerId: message.playerId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

function toOutbound(event: RealtimeEvent): OutboundEvent {
  if (event.type === 'chat.message') {
    return { type: 'chat.message', message: toWireMessage(event.message) };
  }

  if (event.type === 'dice.rolled') {
    return { type: 'dice.rolled', ...event.roll };
  }

  return event;
}

export function toWireMessages(messages: ChatMessage[]): ChatMessageWire[] {
  return messages.map(toWireMessage);
}
