import { asc, eq } from 'drizzle-orm';
import type {
  PlayerDirectory,
  PlayerRef,
} from '@shared/player-directory/player-directory.contract.js';
import { db } from '../index.js';
import { character, player } from '../schema.js';

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

    async findCharactersByGame(gameId: string): Promise<Map<string, string[]>> {
      const rows = await db
        .select({ playerId: character.playerId, characterId: character.id })
        .from(character)
        .where(eq(character.gameId, gameId))
        .orderBy(asc(character.createdAt), asc(character.id));

      const byPlayer = new Map<string, string[]>();
      for (const row of rows) {
        const ids = byPlayer.get(row.playerId) ?? [];
        ids.push(row.characterId);
        byPlayer.set(row.playerId, ids);
      }

      return byPlayer;
    },
  };
}
