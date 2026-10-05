import { eq } from 'drizzle-orm';
import type {
  Player,
  UpdatePlayerInput,
} from '@modules/player/player.entity.js';
import { PlayerNotFoundError } from '@modules/player/player.errors.js';
import type { PlayerRepository } from '@modules/player/player.repository.js';
import { db } from '../index.js';
import { player } from '../schema.js';

type PlayerRow = typeof player.$inferSelect;

function toEntity(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function playerRepository(): PlayerRepository {
  return {
    async findById(id: string): Promise<Player | null> {
      const [row] = await db
        .select()
        .from(player)
        .where(eq(player.id, id))
        .limit(1);

      return row ? toEntity(row) : null;
    },

    async findByName(name: string): Promise<Player | null> {
      const [row] = await db
        .select()
        .from(player)
        .where(eq(player.name, name))
        .limit(1);

      return row ? toEntity(row) : null;
    },

    async save(id: string, input: UpdatePlayerInput): Promise<Player> {
      const [row] = await db
        .update(player)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(player.id, id))
        .returning();

      if (!row) throw new PlayerNotFoundError();

      return toEntity(row);
    },
  };
}
