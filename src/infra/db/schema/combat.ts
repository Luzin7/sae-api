import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { combatantKindEnum } from './enums.js';
import { session } from './session.js';

export const combatState = pgTable('combat_state', {
  sessionId: uuid('session_id')
    .primaryKey()
    .references(() => session.id, {
      onDelete: 'cascade',
    }),
  active: boolean('active').default(true).notNull(),
  turnIndex: integer('turn_index').default(0).notNull(),
  round: integer('round').default(1).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const combatant = pgTable(
  'combatant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => session.id, {
        onDelete: 'cascade',
      }),
    kind: combatantKindEnum('kind').notNull(),
    refId: uuid('ref_id').notNull(),
    name: varchar('name', {
      length: 150,
    }).notNull(),
    initiativeValue: integer('initiative_value'),
    hasRolled: boolean('has_rolled').default(false).notNull(),
    currentHp: integer('current_hp'),
    maxHp: integer('max_hp'),
    currentEffort: integer('current_effort'),
    maxEffort: integer('max_effort'),
    afflictions: text('afflictions').array(),
    cognition: integer('cognition'),
    psyche: integer('psyche'),
    instinct: integer('instinct'),
    constitution: integer('constitution'),
    motricity: integer('motricity'),
    perception: integer('perception'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    unique('combatant_session_kind_ref_unique').on(
      t.sessionId,
      t.kind,
      t.refId,
    ),
    index('combatant_session_idx').on(t.sessionId),
    check(
      'combatant_effort_range_check',
      sql`${t.currentEffort} IS NULL OR ${t.maxEffort} IS NULL OR (${t.currentEffort} >= 0 AND ${t.currentEffort} <= ${t.maxEffort})`,
    ),
  ],
);

export type CombatState = typeof combatState.$inferSelect;
export type NewCombatState = typeof combatState.$inferInsert;
export type Combatant = typeof combatant.$inferSelect;
export type NewCombatant = typeof combatant.$inferInsert;
