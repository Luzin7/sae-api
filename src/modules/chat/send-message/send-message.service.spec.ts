import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatForbiddenError } from '../chat.errors.js';
import { InMemoryMessageBus } from '../chat.bus.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import { storedChatMessage } from '../chat.testkit.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { SendMessageService } from './send-message.service.js';

function makeMessages(): ChatMessageRepository {
  return {
    findSession: vi.fn(),
    appendChat: vi.fn(),
    appendLog: vi.fn(),
    listRecentChat: vi.fn(),
    findTestById: vi.fn(),
    findLatestTest: vi.fn(),
    isTestClosed: vi.fn(),
    hasRolledTest: vi.fn(),
    listTestRollers: vi.fn(),
  };
}

function makeAccess(): GameAccess {
  return { findById: vi.fn(), isMember: vi.fn(), mastersAnyGame: vi.fn() };
}

async function sendAs(playerId: string, storedPlayerId = playerId) {
  const messages = makeMessages();
  const access = makeAccess();
  const bus = new InMemoryMessageBus();
  const publish = vi.spyOn(bus, 'publish');
  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'master-1',
  });
  vi.mocked(access.isMember).mockResolvedValue(true);
  vi.mocked(messages.appendChat).mockResolvedValue(
    storedChatMessage({ playerId: storedPlayerId }),
  );

  const message = await new SendMessageService(messages, access, bus).execute({
    playerId,
    sessionId: 'session-1',
    body: 'Olá.',
  });

  return { message, publish };
}

describe('SendMessageService', () => {
  beforeEach(() => vi.clearAllMocks());

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

  it('marks the game master as the author and publishes it', async () => {
    const { message, publish } = await sendAs('master-1');

    expect(message.authorRole).toBe('master');
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'chat.message',
      message: {
        ...storedChatMessage({ playerId: 'master-1' }),
        authorRole: 'master',
      },
    });
  });

  it('marks a regular player as the author and publishes it', async () => {
    const { message, publish } = await sendAs('p1');

    expect(message.authorRole).toBe('player');
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'chat.message',
      message: {
        ...storedChatMessage({ playerId: 'p1' }),
        authorRole: 'player',
      },
    });
  });

  it('derives the author role from the stored row, not the sender', async () => {
    const { message } = await sendAs('p1', 'master-1');

    expect(message.authorRole).toBe('master');
  });
});
