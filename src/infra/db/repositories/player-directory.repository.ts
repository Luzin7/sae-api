import { eq } from 'drizzle-orm';
import type {
  PlayerDirectory,
  PlayerRef,
} from '@modules/chat/player-directory.contract.js';
import { db } from '../index.js';
import { player } from '../schema.js';

export function playerDirectoryRepository(): PlayerDirectory {
  return {
    async findById(playerId: string): Promise<PlayerRef | null> {
      const [row] = await db
        .select({ id: player.id, name: player.name })
        .from(player)
        .where(eq(player.id, playerId))
        .limit(1);

      return row ?? null;
    },
  };
}
