import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import {
  requireParticipant,
  requireSessionInGame,
} from '../session.authorization.js';
import {
  DEFAULT_LOG_PAGE,
  type Page,
  type SessionLog,
} from '../session.entity.js';
import type { SessionRepository } from '../session.repository.js';

export class ListLogsService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly access: GameAccess,
  ) {}

  async execute(
    gameId: string,
    sessionId: string,
    playerId: string,
    page: Page = DEFAULT_LOG_PAGE,
  ): Promise<SessionLog[]> {
    await requireParticipant(this.access, gameId, playerId);
    await requireSessionInGame(this.sessions, gameId, sessionId);

    return this.sessions.listLogs(sessionId, page);
  }
}
