import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const player = pgTable('player', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', {
    length: 100,
  })
    .notNull()
    .unique(),
  passwordHash: varchar('password_hash', {
    length: 255,
  }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const authSession = pgTable(
  'auth_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => player.id, {
        onDelete: 'cascade',
      }),
    tokenHash: varchar('token_hash', {
      length: 64,
    })
      .notNull()
      .unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at'),
    familyId: uuid('family_id').notNull().defaultRandom(),
    usedAt: timestamp('used_at'),
    revokedAt: timestamp('revoked_at'),
    replacedById: uuid('replaced_by_id'),
  },
  (t) => [
    index('auth_session_player_idx').on(t.playerId),
    index('auth_session_expires_idx').on(t.expiresAt),
    index('auth_session_family_idx').on(t.familyId),
  ],
);

export type Player = typeof player.$inferSelect;
export type NewPlayer = typeof player.$inferInsert;
