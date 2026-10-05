import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import {
  type GameSession,
  type SessionLog,
} from '../session.entity.js';
import { SessionNotFoundError } from '../session.errors.js';
import type { SessionRepository } from '../session.repository.js';
import { ListLogsService } from './list-logs.service.js';

const PAGE = { limit: 50, offset: 0 };

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

function makeLog(overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: 'log-1',
    sessionId: 'session-1',
    playerId: 'p1',
    eventType: 'chat',
    payload: { text: 'hello' },
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
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

describe('ListLogsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids a player who is not a participant', async () => {
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(false);

    await expect(
      new ListLogsService(makeSessions(), access).execute(
        'game-1',
        'session-1',
        'p1',
        PAGE,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('forbids reading a session that belongs to another game (IDOR)', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(sessions.findById).mockResolvedValue(
      makeSession({ gameId: 'game-2' }),
    );

    await expect(
      new ListLogsService(sessions, access).execute(
        'game-1',
        'session-1',
        'p1',
        PAGE,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(sessions.listLogs).not.toHaveBeenCalled();
  });

  it('throws SessionNotFoundError when the session does not exist', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(sessions.findById).mockResolvedValue(null);

    await expect(
      new ListLogsService(sessions, access).execute(
        'game-1',
        'session-1',
        'p1',
        PAGE,
      ),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('returns paginated logs for a member in the right game', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(true);
    vi.mocked(sessions.findById).mockResolvedValue(makeSession());
    vi.mocked(sessions.listLogs).mockResolvedValue([makeLog()]);

    const result = await new ListLogsService(sessions, access).execute(
      'game-1',
      'session-1',
      'p1',
      PAGE,
    );

    expect(sessions.listLogs).toHaveBeenCalledWith('session-1', PAGE);
    expect(result).toHaveLength(1);
  });
});
