import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { SessionRepository } from '../session.repository.js';
import { EndSessionService } from './end-session.service.js';

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
  return { findById: vi.fn(), isMember: vi.fn(), mastersAnyGame: vi.fn() };
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
});
