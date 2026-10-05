import { and, eq } from 'drizzle-orm';
import type {
  GameAccess,
  GameRef,
} from '@shared/game-access/game-access.contract.js';
import { db } from '../index.js';
import { game, playerGame } from '../schema.js';

export function gameAccessRepository(): GameAccess {
  return {
    async findById(gameId: string): Promise<GameRef | null> {
      const [row] = await db
        .select({ id: game.id, masterId: game.masterId })
        .from(game)
        .where(eq(game.id, gameId))
        .limit(1);

      return row ?? null;
    },

    async isMember(gameId: string, playerId: string): Promise<boolean> {
      const [row] = await db
        .select({ playerId: playerGame.playerId })
        .from(playerGame)
        .where(
          and(
            eq(playerGame.gameId, gameId),
            eq(playerGame.playerId, playerId),
          ),
        )
        .limit(1);

      return row !== undefined;
    },
  };
}
