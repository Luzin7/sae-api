import { requireMaster } from '../game.authorization.js';
import type { GameRepository } from '../game.repository.js';

export class DeleteGameService {
  constructor(private readonly games: GameRepository) {}

  async execute(gameId: string, playerId: string): Promise<void> {
    await requireMaster(this.games, gameId, playerId);

    await this.games.delete(gameId);
  }
}
