import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { game } from './game.js';
import { player } from './player.js';

export const monster = pgTable(
  'monster',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id').references(() => game.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', {
      length: 150,
    }).notNull(),
    np: integer('np').default(1).notNull(),
    maxHp: integer('max_hp').default(0).notNull(),
    currentHp: integer('current_hp').default(0).notNull(),
    maxEffort: integer('max_effort').default(0).notNull(),
    currentEffort: integer('current_effort').default(0).notNull(),
    size: varchar('size', {
      length: 30,
    }),
    cognition: integer('cognition').default(-5).notNull(),
    psyche: integer('psyche').default(-5).notNull(),
    instinct: integer('instinct').default(-5).notNull(),
    constitution: integer('constitution').default(-5).notNull(),
    motricity: integer('motricity').default(-5).notNull(),
    perception: integer('perception').default(-5).notNull(),
    heightCm: integer('height_cm'),
    weightKg: numeric('weight_kg', {
      precision: 5,
      scale: 2,
      mode: 'number',
    }),
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => player.id),
    clientRequestId: uuid('client_request_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('monster_game_idx').on(t.gameId),
    index('monster_owner_idx').on(t.createdBy),
    uniqueIndex('monster_creator_client_request_uq').on(
      t.createdBy,
      t.clientRequestId,
    ),
    check('monster_np_check', sql`${t.np} BETWEEN 1 AND 20`),
  ],
);

export type Monster = typeof monster.$inferSelect;
export type NewMonster = typeof monster.$inferInsert;
