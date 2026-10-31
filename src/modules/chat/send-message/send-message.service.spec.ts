import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatForbiddenError } from '../chat.errors.js';
import { InMemoryMessageBus } from '../chat.bus.js';
import type { ChatMessageRepository } from '../chat.repository.js';
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
});
