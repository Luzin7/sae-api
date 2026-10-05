import { and, eq } from 'drizzle-orm';
import type {
  Game,
  GamePlayer,
  GameSummary,
  Page,
  UpdateGameInput,
} from '@modules/game/game.entity.js';
import {
  GameNotFoundError,
  InviteCodeConflictError,
} from '@modules/game/game.errors.js';
import type { GameRepository } from '@modules/game/game.repository.js';
import { db } from '../index.js';
import { game, player, playerGame } from '../schema.js';

type GameRow = typeof game.$inferSelect;
type GameInsert = typeof game.$inferInsert;
type SummaryRow = { id: string; name: string };

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    masterId: row.masterId,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    inviteCode: row.inviteCode,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSummary(row: SummaryRow): GameSummary {
  return { id: row.id, name: row.name };
}

function toPlayer(row: SummaryRow): GamePlayer {
  return { id: row.id, name: row.name };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  return 'code' in error && error.code === '23505';
}

function toChanges(input: UpdateGameInput): Partial<GameInsert> {
  const changes: Partial<GameInsert> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.description !== undefined) changes.description = input.description;
  if (input.imageUrl !== undefined) changes.imageUrl = input.imageUrl;
  if (input.isActive !== undefined) changes.isActive = input.isActive;
  changes.updatedAt = new Date();

  return changes;
}

export function gameRepository(): GameRepository {
  return {
    async create(masterId, input): Promise<Game> {
      try {
        const [row] = await db
          .insert(game)
          .values({
            masterId,
            name: input.name,
            description: input.description ?? null,
            imageUrl: input.imageUrl ?? null,
            inviteCode: input.inviteCode,
          })
          .returning();
        if (!row) throw new GameNotFoundError();

        return toGame(row);
      } catch (error) {
        if (isUniqueViolation(error)) throw new InviteCodeConflictError();
        throw error;
      }
    },

    async findById(id: string): Promise<Game | null> {
      const [row] = await db
        .select()
        .from(game)
        .where(eq(game.id, id))
        .limit(1);

      return row ? toGame(row) : null;
    },

    async findByInviteCode(inviteCode: string): Promise<Game | null> {
      const [row] = await db
        .select()
        .from(game)
        .where(eq(game.inviteCode, inviteCode))
        .limit(1);

      return row ? toGame(row) : null;
    },

    async findMastered(masterId: string): Promise<GameSummary[]> {
      const rows = await db
        .select({ id: game.id, name: game.name })
        .from(game)
        .where(eq(game.masterId, masterId));

      return rows.map(toSummary);
    },

    async findJoined(playerId: string, page: Page): Promise<GameSummary[]> {
      const rows = await db
        .select({ id: game.id, name: game.name })
        .from(game)
        .innerJoin(playerGame, eq(playerGame.gameId, game.id))
        .where(eq(playerGame.playerId, playerId))
        .limit(page.limit)
        .offset(page.offset);

      return rows.map(toSummary);
    },

    async update(id: string, input: UpdateGameInput): Promise<Game> {
      const [row] = await db
        .update(game)
        .set(toChanges(input))
        .where(eq(game.id, id))
        .returning();
      if (!row) throw new GameNotFoundError();

      return toGame(row);
    },

    async delete(id: string): Promise<void> {
      await db.delete(game).where(eq(game.id, id));
    },

    async addPlayer(gameId: string, playerId: string): Promise<void> {
      await db
        .insert(playerGame)
        .values({ gameId, playerId })
        .onConflictDoNothing();
    },

    async removePlayer(gameId: string, playerId: string): Promise<void> {
      await db
        .delete(playerGame)
        .where(
          and(
            eq(playerGame.gameId, gameId),
            eq(playerGame.playerId, playerId),
          ),
        );
    },

    async findPlayers(gameId: string): Promise<GamePlayer[]> {
      const rows = await db
        .select({ id: player.id, name: player.name })
        .from(playerGame)
        .innerJoin(player, eq(player.id, playerGame.playerId))
        .where(eq(playerGame.gameId, gameId));

      return rows.map(toPlayer);
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
