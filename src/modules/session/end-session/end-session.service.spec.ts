import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { GameSession } from '../session.entity.js';
import { SessionNotFoundError } from '../session.errors.js';
import type { SessionRepository } from '../session.repository.js';
import { EndSessionService } from './end-session.service.js';

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 'session-1',
    gameId: 'game-1',
    isActive: true,
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
    endedAt: null,
    ...overrides,
  };
}

function makeSessions(): SessionRepository {
  return {
    create: vi.fn(),
    findActiveByGame: vi.fn(),
    findById: vi.fn(),
    end: vi.fn(),
    appendLog: vi.fn(),
    listLogs: vi.fn(),
  };
}

function makeAccess(): GameAccess {
  return { findById: vi.fn(), isMember: vi.fn() };
}

describe('EndSessionService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids when the requester is not the master', async () => {
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    await expect(
      new EndSessionService(makeSessions(), access).execute('game-1', 'p2'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws SessionNotFoundError when there is no active session', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(null);

    await expect(
      new EndSessionService(sessions, access).execute('game-1', 'p1'),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('ends the active session for the master', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(makeSession());
    vi.mocked(sessions.end).mockResolvedValue(
      makeSession({ isActive: false, endedAt: new Date() }),
    );

    const result = await new EndSessionService(sessions, access).execute(
      'game-1',
      'p1',
    );

    expect(sessions.end).toHaveBeenCalledWith('session-1');
    expect(result.isActive).toBe(false);
  });
});
