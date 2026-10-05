import type { Player } from '../player.entity.js';
import { PlayerNotFoundError } from '../player.errors.js';
import type { PlayerRepository } from '../player.repository.js';

export class GetMeService {
  constructor(private readonly players: PlayerRepository) {}

  async execute(playerId: string): Promise<Player> {
    const player = await this.players.findById(playerId);
    if (!player) throw new PlayerNotFoundError();

    return player;
  }
}
