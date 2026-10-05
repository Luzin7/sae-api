import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../chat.entity.js';
import {
  ChatForbiddenError,
  ChatSessionNotFoundError,
  EmptyChatMessageError,
} from '../chat.errors.js';
import { InMemoryMessageBus } from '../chat.bus.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { SendMessageService } from './send-message.service.js';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    sessionId: 'session-1',
    playerId: 'p1',
    body: 'hello',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeMessages(): ChatMessageRepository {
  return {
    findSession: vi.fn(),
    appendChat: vi.fn(),
    appendLog: vi.fn(),
    listRecentChat: vi.fn(),
  };
}

function makeAccess(): GameAccess {
  return { findById: vi.fn(), isMember: vi.fn() };
}

describe('SendMessageService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws ChatSessionNotFoundError when the session does not exist', async () => {
    const messages = makeMessages();
    vi.mocked(messages.findSession).mockResolvedValue(null);

    await expect(
      new SendMessageService(
        messages,
        makeAccess(),
        new InMemoryMessageBus(),
      ).execute({ playerId: 'p1', sessionId: 'session-1', body: 'hi' }),
    ).rejects.toBeInstanceOf(ChatSessionNotFoundError);
    expect(messages.appendChat).not.toHaveBeenCalled();
  });

  it('forbids a non-member before persisting anything', async () => {
    const messages = makeMessages();
    const access = makeAccess();
    vi.mocked(messages.findSession).mockResolvedValue({
      id: 'session-1',
      gameId: 'game-1',
    });
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(false);

    await expect(
      new SendMessageService(
        messages,
        access,
        new InMemoryMessageBus(),
      ).execute({ playerId: 'p1', sessionId: 'session-1', body: 'hi' }),
    ).rejects.toBeInstanceOf(ChatForbiddenError);
    expect(messages.appendChat).not.toHaveBeenCalled();
  });

  it('rejects a body that is blank after trimming', async () => {
    const messages = makeMessages();
    const access = makeAccess();
    vi.mocked(messages.findSession).mockResolvedValue({
      id: 'session-1',
      gameId: 'game-1',
    });
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });

    await expect(
      new SendMessageService(
        messages,
        access,
        new InMemoryMessageBus(),
      ).execute({ playerId: 'p1', sessionId: 'session-1', body: '   ' }),
    ).rejects.toBeInstanceOf(EmptyChatMessageError);
    expect(messages.appendChat).not.toHaveBeenCalled();
  });

  it('persists the trimmed message before publishing it', async () => {
    const messages = makeMessages();
    const access = makeAccess();
    const bus = new InMemoryMessageBus();
    const publish = vi.spyOn(bus, 'publish');
    const message = makeMessage();
    vi.mocked(messages.findSession).mockResolvedValue({
      id: 'session-1',
      gameId: 'game-1',
    });
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(messages.appendChat).mockResolvedValue(message);

    const result = await new SendMessageService(messages, access, bus).execute({
      playerId: 'p1',
      sessionId: 'session-1',
      body: '  hello  ',
    });

    expect(messages.appendChat).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'p1',
      body: 'hello',
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'chat.message',
      message,
    });
    expect(
      vi.mocked(messages.appendChat).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
    expect(result).toBe(message);
  });
});
