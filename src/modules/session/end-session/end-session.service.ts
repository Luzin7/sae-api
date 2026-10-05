import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { requireMaster } from '../session.authorization.js';
import type { GameSession } from '../session.entity.js';
import { SessionNotFoundError } from '../session.errors.js';
import type { SessionRepository } from '../session.repository.js';

export class EndSessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly access: GameAccess,
  ) {}

  async execute(gameId: string, playerId: string): Promise<GameSession> {
    await requireMaster(this.access, gameId, playerId);

    const active = await this.sessions.findActiveByGame(gameId);
    if (!active) throw new SessionNotFoundError();

    return this.sessions.end(active.id);
  }
}
