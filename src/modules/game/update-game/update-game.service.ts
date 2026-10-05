import { requireMaster } from '../game.authorization.js';
import type { Game, UpdateGameInput } from '../game.entity.js';
import type { GameRepository } from '../game.repository.js';

export class UpdateGameService {
  constructor(private readonly games: GameRepository) {}

  async execute(
    gameId: string,
    playerId: string,
    input: UpdateGameInput,
  ): Promise<Game> {
    await requireMaster(this.games, gameId, playerId);

    return this.games.update(gameId, input);
  }
}
