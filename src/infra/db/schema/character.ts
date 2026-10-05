import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  itemSlotEnum,
  itemTypeEnum,
  proficiencyLevelEnum,
  socialClassEnum,
} from './enums.js';
import { game } from './game.js';
import { player } from './player.js';
import { skill } from './skill.js';

export const character = pgTable(
  'character',
  {
    id: uuid('id').primaryKey().defaultRandom(),
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
    nickname: varchar('nickname', {
      length: 150,
    }).notNull(),
    epithet: varchar('epithet', {
      length: 100,
    }),
    /*
     * NP — Nível de Personagem.
     * O mestre controla diretamente esse valor.
     * Não existe XP armazenado.
     * BExp é derivado do NP:
     * Math.floor(np / 2)
     */
    np: integer('np').default(1).notNull(),
    cognition: integer('cognition').default(-5).notNull(),
    psyche: integer('psyche').default(-5).notNull(),
    instinct: integer('instinct').default(-5).notNull(),
    constitution: integer('constitution').default(-5).notNull(),
    motricity: integer('motricity').default(-5).notNull(),
    perception: integer('perception').default(-5).notNull(),
    /* -----------------------------------------------------
     * Proficiência dos atributos
     *
     * A proficiência determina o orçamento de pontos
     * distribuíveis entre as perícias daquele atributo.
     *
     * imperito     -> 2
     * competente   -> 6
     * versado      -> 10
     * especialista -> 14
     * --------------------------------------------------- */
    cognitionProficiency: proficiencyLevelEnum('cognition_proficiency')
      .default('imperito')
      .notNull(),
    psycheProficiency: proficiencyLevelEnum('psyche_proficiency')
      .default('imperito')
      .notNull(),
    instinctProficiency: proficiencyLevelEnum('instinct_proficiency')
      .default('imperito')
      .notNull(),
    constitutionProficiency: proficiencyLevelEnum('constitution_proficiency')
      .default('imperito')
      .notNull(),
    motricityProficiency: proficiencyLevelEnum('motricity_proficiency')
      .default('imperito')
      .notNull(),
    perceptionProficiency: proficiencyLevelEnum('perception_proficiency')
      .default('imperito')
      .notNull(),
    maxHp: integer('max_hp').default(0).notNull(),
    maxEffort: integer('max_effort').default(0).notNull(),
    bExp: integer('b_exp').default(0).notNull(),
    currentHp: integer('current_hp').default(0).notNull(),
    currentEffort: integer('current_effort').default(0).notNull(),
    hairColor: varchar('hair_color', {
      length: 50,
    }),
    heightCm: integer('height_cm'),
    weightKg: numeric('weight_kg', {
      precision: 5,
      scale: 2,
      mode: 'number',
    }),
    size: varchar('size', {
      length: 30,
    }),
    background: text('background'),
    profession: varchar('profession', {
      length: 100,
    }),
    motivation: text('motivation'),
    affliction: text('affliction'),
    socialClass: socialClassEnum('social_class'),
    vaalaques: integer('vaalaques').default(0).notNull(),
    bonds: text('bonds'),
    personality: varchar('personality', {
      length: 50,
    }),
    posture: varchar('posture', {
      length: 50,
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('character_player_idx').on(t.playerId),
    index('character_game_idx').on(t.gameId),
    check('character_np_check', sql`${t.np} BETWEEN 1 AND 20`),
  ],
);

export const characterSkill = pgTable(
  'character_skill',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => character.id, {
        onDelete: 'cascade',
      }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skill.id, {
        onDelete: 'cascade',
      }),
    proficiencyBonus: integer('proficiency_bonus').default(0).notNull(),
  },
  (t) => [
    unique('character_skill_unique').on(t.characterId, t.skillId),
    index('character_skill_skill_idx').on(t.skillId),
  ],
);

export const characterItem = pgTable(
  'character_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => character.id, {
        onDelete: 'cascade',
      }),
    name: varchar('name', {
      length: 100,
    }).notNull(),
    type: itemTypeEnum('type').notNull(),
    slot: itemSlotEnum('slot').default('backpack').notNull(),
    equipped: boolean('equipped').default(false).notNull(),
    description: text('description'),
    quantity: integer('quantity').default(1).notNull(),
    attributes: jsonb('attributes'),
  },
  (t) => [index('character_item_character_idx').on(t.characterId)],
);

export type Character = typeof character.$inferSelect;
export type NewCharacter = typeof character.$inferInsert;
export type CharacterSkill = typeof characterSkill.$inferSelect;
export type NewCharacterSkill = typeof characterSkill.$inferInsert;
export type CharacterItem = typeof characterItem.$inferSelect;
export type NewCharacterItem = typeof characterItem.$inferInsert;
