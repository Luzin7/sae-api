import type { Player, UpdatePlayerInput } from '../player.entity.js';
import {
  PlayerNameTakenError,
  PlayerNotFoundError,
} from '../player.errors.js';
import type { PlayerRepository } from '../player.repository.js';

export class UpdateMeService {
  constructor(private readonly players: PlayerRepository) {}

  async execute(playerId: string, input: UpdatePlayerInput): Promise<Player> {
    const player = await this.players.findById(playerId);
    if (!player) throw new PlayerNotFoundError();

    if (input.name !== player.name) {
      const taken = await this.players.findByName(input.name);
      if (taken) throw new PlayerNameTakenError();
    }

    return this.players.save(playerId, input);
  }
}
