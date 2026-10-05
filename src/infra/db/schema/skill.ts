import { pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { attributeEnum } from './enums.js';

export const skill = pgTable('skill', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', {
    length: 100,
  })
    .notNull()
    .unique(),
  attribute: attributeEnum('attribute').notNull(),
  description: text('description'),
});

export type Skill = typeof skill.$inferSelect;
export type NewSkill = typeof skill.$inferInsert;
