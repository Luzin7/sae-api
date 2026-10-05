import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { requireParticipant } from '../session.authorization.js';
import type { GameSession } from '../session.entity.js';
import type { SessionRepository } from '../session.repository.js';

export class GetActiveService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly access: GameAccess,
  ) {}

  async execute(gameId: string, playerId: string): Promise<GameSession | null> {
    await requireParticipant(this.access, gameId, playerId);

    return this.sessions.findActiveByGame(gameId);
  }
}
