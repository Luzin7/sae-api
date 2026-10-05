import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { player } from './player.js';

export const game = pgTable(
  'game',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => player.id),
    name: varchar('name', {
      length: 100,
    }).notNull(),
    description: text('description'),
    imageUrl: varchar('image_url', {
      length: 500,
    }),
    inviteCode: varchar('invite_code', {
      length: 20,
    })
      .notNull()
      .unique(),
    isActive: boolean('is_active').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('game_master_idx').on(t.masterId),
    index('game_invite_code_idx').on(t.inviteCode),
  ],
);

export const playerGame = pgTable(
  'player_game',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => player.id, {
        onDelete: 'cascade',
      }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => game.id, {
        onDelete: 'cascade',
      }),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.playerId, t.gameId],
    }),

    index('player_game_game_idx').on(t.gameId),
  ],
);

export type Game = typeof game.$inferSelect;
export type NewGame = typeof game.$inferInsert;
export type PlayerGame = typeof playerGame.$inferSelect;
export type NewPlayerGame = typeof playerGame.$inferInsert;
