import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import type { ChatMessage } from './chat.entity.js';
import { sinkFor, toWireMessages } from './chat.transport.js';

function chatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'log-1',
    sessionId: 'session-1',
    playerId: 'master-1',
    body: 'A névoa avança.',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    authorRole: 'master',
    ...overrides,
  };
}

describe('chat transport authorRole', () => {
  it('carries the role into every chat.history message', () => {
    expect(
      toWireMessages([
        chatMessage({ authorRole: 'master' }),
        chatMessage({
          id: 'log-2',
          playerId: 'p1',
          authorRole: 'player',
        }),
      ]),
    ).toEqual([
      {
        id: 'log-1',
        sessionId: 'session-1',
        playerId: 'master-1',
        body: 'A névoa avança.',
        createdAt: '2024-01-01T00:00:00.000Z',
        authorRole: 'master',
      },
      {
        id: 'log-2',
        sessionId: 'session-1',
        playerId: 'p1',
        body: 'A névoa avança.',
        createdAt: '2024-01-01T00:00:00.000Z',
        authorRole: 'player',
      },
    ]);
  });

  it('carries the role into a chat.message frame', () => {
    const sent: string[] = [];
    const socket = {
      send: (data: string) => sent.push(data),
    } as unknown as WebSocket;

    sinkFor(socket)({
      type: 'chat.message',
      message: chatMessage({ authorRole: 'master' }),
    });

    expect(JSON.parse(sent[0] ?? '')).toEqual({
      type: 'chat.message',
      message: {
        id: 'log-1',
        sessionId: 'session-1',
        playerId: 'master-1',
        body: 'A névoa avança.',
        createdAt: '2024-01-01T00:00:00.000Z',
        authorRole: 'master',
      },
    });
  });
});
