import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError } from '@shared/errors/http-errors.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { GameSession } from '../session.entity.js';
import type { SessionRepository } from '../session.repository.js';
import { StartSessionService } from './start-session.service.js';

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

describe('StartSessionService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids when the game does not exist', async () => {
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue(null);

    await expect(
      new StartSessionService(makeSessions(), access).execute('game-1', 'p1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('forbids when the requester is not the master', async () => {
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    await expect(
      new StartSessionService(makeSessions(), access).execute('game-1', 'p2'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('conflicts when a session is already active', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(makeSession());

    await expect(
      new StartSessionService(sessions, access).execute('game-1', 'p1'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('creates a session for the master', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(null);
    vi.mocked(sessions.create).mockResolvedValue(makeSession());

    const result = await new StartSessionService(sessions, access).execute(
      'game-1',
      'p1',
    );

    expect(sessions.create).toHaveBeenCalledWith('game-1');
    expect(result.isActive).toBe(true);
  });
});
