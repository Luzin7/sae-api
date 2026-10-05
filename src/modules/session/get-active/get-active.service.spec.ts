import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { GameSession } from '../session.entity.js';
import type { SessionRepository } from '../session.repository.js';
import { GetActiveService } from './get-active.service.js';

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

describe('GetActiveService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids when the game does not exist', async () => {
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue(null);

    await expect(
      new GetActiveService(makeSessions(), access).execute('game-1', 'p1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('forbids a player who is not in the game', async () => {
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(false);

    await expect(
      new GetActiveService(makeSessions(), access).execute('game-1', 'p1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('returns the active session for the master without a membership check', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(makeSession());

    const result = await new GetActiveService(sessions, access).execute(
      'game-1',
      'p1',
    );

    expect(access.isMember).not.toHaveBeenCalled();
    expect(result?.id).toBe('session-1');
  });

  it('returns the active session for a member', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(true);
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(makeSession());

    const result = await new GetActiveService(sessions, access).execute(
      'game-1',
      'p1',
    );

    expect(result?.id).toBe('session-1');
  });

  it('returns null when there is no active session', async () => {
    const sessions = makeSessions();
    const access = makeAccess();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(null);

    const result = await new GetActiveService(sessions, access).execute(
      'game-1',
      'p1',
    );

    expect(result).toBeNull();
  });
});
