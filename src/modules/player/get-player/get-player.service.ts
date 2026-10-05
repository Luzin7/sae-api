import type { PlayerProfile } from '../player.entity.js';
import { PlayerNotFoundError } from '../player.errors.js';
import type { PlayerRepository } from '../player.repository.js';

export class GetPlayerService {
  constructor(private readonly players: PlayerRepository) {}

  async execute(playerId: string): Promise<PlayerProfile> {
    // TODO: shared game or friends authorization (deferred).
    const player = await this.players.findById(playerId);
    if (!player) throw new PlayerNotFoundError();

    return {
      id: player.id,
      name: player.name,
      createdAt: player.createdAt,
    };
  }
}
