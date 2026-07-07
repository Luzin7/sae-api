import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, real, text, timestamp, unique, uuid, varchar, } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
export const player = pgTable('player', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const refreshToken = pgTable('refresh_token', {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
        .notNull()
        .references(() => player.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 500 }).notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('rt_player_idx').on(t.playerId), index('rt_token_idx').on(t.token)]);
export const game = pgTable('game', {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
        .notNull()
        .references(() => player.id),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    imageUrl: varchar('image_url', { length: 500 }),
    inviteCode: varchar('invite_code', { length: 20 }).notNull().unique(),
    isActive: boolean('is_active').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
    index('game_master_idx').on(t.masterId),
    index('game_invite_code_idx').on(t.inviteCode),
]);
export const playerGame = pgTable('player_game', {
    playerId: uuid('player_id')
        .notNull()
        .references(() => player.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
        .notNull()
        .references(() => game.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.playerId, t.gameId] }), index('pg_game_idx').on(t.gameId)]);
export const skillEnum = pgEnum('skill_name', [
    'knowledge',
    'investigation',
    'medicine',
    'technology',
    'craft',
    'empathy',
    'deception',
    'intimidation',
    'persuasion',
    'presence',
    'acrobatics',
    'stealth',
    'survival_instinct',
    'tactile_perception',
    'reflexes',
    'athletics',
    'endurance',
    'tolerance',
    'vitality',
    'willpower',
    'melee_weapons',
    'firearms',
    'driving',
    'body_stealth',
    'piloting',
    'hearing',
    'smell',
    'taste',
    'touch',
    'vision',
]);
export const character = pgTable('character', {
    id: uuid('id').primaryKey().defaultRandom(),
    playerId: uuid('player_id')
        .notNull()
        .references(() => player.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
        .notNull()
        .references(() => game.id, { onDelete: 'cascade' }),
    nickname: varchar('nickname', { length: 150 }).notNull(),
    imageUrl: varchar('image_url', { length: 500 }),
    level: integer('level').default(1).notNull(),
    bExp: integer('b_exp').default(0).notNull(),
    cognition: integer('cognition').default(0).notNull(),
    psyche: integer('psyche').default(0).notNull(),
    instinct: integer('instinct').default(0).notNull(),
    constitution: integer('constitution').default(0).notNull(),
    motricity: integer('motricity').default(0).notNull(),
    perception: integer('perception').default(0).notNull(),
    profCognition: integer('prof_cognition').default(0).notNull(),
    profPsyche: integer('prof_psyche').default(0).notNull(),
    profInstinct: integer('prof_instinct').default(0).notNull(),
    profConstitution: integer('prof_constitution').default(0).notNull(),
    profMotricity: integer('prof_motricity').default(0).notNull(),
    profPerception: integer('prof_perception').default(0).notNull(),
    maxHp: integer('max_hp').default(0).notNull(),
    currentHp: integer('current_hp').default(0).notNull(),
    maxEffort: integer('max_effort').default(0).notNull(),
    currentEffort: integer('current_effort').default(0).notNull(),
    hairColor: varchar('hair_color', { length: 50 }),
    height: real('height'),
    weight: real('weight'),
    size: varchar('size', { length: 30 }),
    background: varchar('background', { length: 100 }),
    profession: varchar('profession', { length: 100 }),
    motivation: varchar('motivation', { length: 100 }),
    affliction: varchar('affliction', { length: 100 }),
    personality: varchar('personality', { length: 50 }),
    posture: varchar('posture', { length: 50 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('char_player_idx').on(t.playerId), index('char_game_idx').on(t.gameId)]);
export const characterSkill = pgTable('character_skill', {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
        .notNull()
        .references(() => character.id, { onDelete: 'cascade' }),
    skill: skillEnum('skill').notNull(),
    points: integer('points').default(0).notNull(),
}, (t) => [
    index('cs_char_idx').on(t.characterId),
    unique().on(t.characterId, t.skill),
]);
export const itemTypeEnum = pgEnum('item_type', [
    'weapon',
    'armor',
    'overlay',
    'coating',
    'accessory',
    'consumable',
    'misc',
]);
export const itemSlotEnum = pgEnum('item_slot', [
    'head',
    'torso',
    'arms',
    'hands',
    'legs',
    'feet',
    'ring_1',
    'ring_2',
    'external',
    'backpack',
]);
export const characterItem = pgTable('character_item', {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
        .notNull()
        .references(() => character.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    type: itemTypeEnum('type').notNull(),
    slot: itemSlotEnum('slot').default('backpack').notNull(),
    equipped: boolean('equipped').default(false).notNull(),
    description: text('description'),
    quantity: integer('quantity').default(1).notNull(),
    attributes: jsonb('attributes'),
}, (t) => [index('ci_char_idx').on(t.characterId)]);
export const session = pgTable('session', {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
        .notNull()
        .references(() => game.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    endedAt: timestamp('ended_at'),
    isActive: boolean('is_active').default(true).notNull(),
}, (t) => [index('sess_game_idx').on(t.gameId)]);
export const eventTypeEnum = pgEnum('event_type', [
    'dice_roll',
    'hp_change',
    'pe_change',
    'chat',
    'player_join',
    'player_leave',
    'master_broadcast',
]);
export const sessionLog = pgTable('session_log', {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
        .notNull()
        .references(() => session.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id').references(() => player.id),
    eventType: eventTypeEnum('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('sl_session_idx').on(t.sessionId)]);
export const playerRelations = relations(player, ({ many }) => ({
    refreshTokens: many(refreshToken),
    playerGames: many(playerGame),
    characters: many(character),
}));
export const refreshTokenRelations = relations(refreshToken, ({ one }) => ({
    player: one(player, { fields: [refreshToken.playerId], references: [player.id] }),
}));
export const gameRelations = relations(game, ({ one, many }) => ({
    master: one(player, { fields: [game.masterId], references: [player.id] }),
    playerGames: many(playerGame),
    sessions: many(session),
}));
export const playerGameRelations = relations(playerGame, ({ one }) => ({
    player: one(player, { fields: [playerGame.playerId], references: [player.id] }),
    game: one(game, { fields: [playerGame.gameId], references: [game.id] }),
}));
export const characterRelations = relations(character, ({ one, many }) => ({
    player: one(player, { fields: [character.playerId], references: [player.id] }),
    game: one(game, { fields: [character.gameId], references: [game.id] }),
    skills: many(characterSkill),
    items: many(characterItem),
}));
export const characterSkillRelations = relations(characterSkill, ({ one }) => ({
    character: one(character, { fields: [characterSkill.characterId], references: [character.id] }),
}));
export const characterItemRelations = relations(characterItem, ({ one }) => ({
    character: one(character, { fields: [characterItem.characterId], references: [character.id] }),
}));
export const sessionRelations = relations(session, ({ one, many }) => ({
    game: one(game, { fields: [session.gameId], references: [game.id] }),
    logs: many(sessionLog),
}));
export const sessionLogRelations = relations(sessionLog, ({ one }) => ({
    session: one(session, { fields: [sessionLog.sessionId], references: [session.id] }),
}));
//# sourceMappingURL=schema.js.map