import { ConflictError } from '@shared/errors/http-errors.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { requireMaster } from '../session.authorization.js';
import type { GameSession } from '../session.entity.js';
import type { SessionRepository } from '../session.repository.js';

export class StartSessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly access: GameAccess,
  ) {}

  async execute(gameId: string, playerId: string): Promise<GameSession> {
    await requireMaster(this.access, gameId, playerId);

    const active = await this.sessions.findActiveByGame(gameId);
    if (active) throw new ConflictError('Já existe uma sessão ativa para este jogo.');

    return this.sessions.create(gameId);
  }
}
