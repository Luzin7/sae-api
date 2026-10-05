import { ForbiddenError } from '@shared/errors/http-errors.js';
import { requireMembership } from '../game.authorization.js';
import type { GameRepository } from '../game.repository.js';

export class LeaveGameService {
  constructor(private readonly games: GameRepository) {}

  async execute(gameId: string, playerId: string): Promise<void> {
    const game = await requireMembership(this.games, gameId, playerId);
    if (game.masterId === playerId) {
      throw new ForbiddenError('O mestre não pode sair do próprio jogo.');
    }

    await this.games.removePlayer(gameId, playerId);
  }
}
