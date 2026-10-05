import type { Player, UpdatePlayerInput } from './player.entity.js';

export interface PlayerRepository {
  findById(id: string): Promise<Player | null>;
  findByName(name: string): Promise<Player | null>;
  save(id: string, input: UpdatePlayerInput): Promise<Player>;
}
