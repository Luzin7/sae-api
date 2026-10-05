import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { eventTypeEnum } from './enums.js';
import { game } from './game.js';
import { player } from './player.js';

export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => game.id, {
        onDelete: 'cascade',
      }),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    endedAt: timestamp('ended_at'),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (t) => [
    index('session_game_idx').on(t.gameId),
    uniqueIndex('session_active_game_unique')
      .on(t.gameId)
      .where(sql`${t.isActive}`),
  ],
);

export const sessionLog = pgTable(
  'session_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => session.id, {
        onDelete: 'cascade',
      }),
    playerId: uuid('player_id').references(() => player.id),
    eventType: eventTypeEnum('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('session_log_session_idx').on(t.sessionId),
    index('session_log_player_idx').on(t.playerId),
  ],
);

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type SessionLog = typeof sessionLog.$inferSelect;
export type NewSessionLog = typeof sessionLog.$inferInsert;
