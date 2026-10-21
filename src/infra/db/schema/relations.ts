import { relations } from 'drizzle-orm';
import { character, characterItem, characterSkill } from './character.js';
import { combatant, combatState } from './combat.js';
import { game, playerGame } from './game.js';
import { monster } from './monster.js';
import { authSession, player } from './player.js';
import { session, sessionLog } from './session.js';
import { skill } from './skill.js';

export const authSessionRelations = relations(authSession, ({ one }) => ({
  player: one(player, {
    fields: [authSession.playerId],
    references: [player.id],
  }),
}));

export const playerRelations = relations(player, ({ many }) => ({
  authSession: many(authSession),
  playerGames: many(playerGame),
  characters: many(character),
  sessionLogs: many(sessionLog),
}));

export const gameRelations = relations(game, ({ one, many }) => ({
  master: one(player, {
    fields: [game.masterId],
    references: [player.id],
  }),

  playerGames: many(playerGame),
  characters: many(character),
  monsters: many(monster),
  sessions: many(session),
}));

export const playerGameRelations = relations(playerGame, ({ one }) => ({
  player: one(player, {
    fields: [playerGame.playerId],
    references: [player.id],
  }),

  game: one(game, {
    fields: [playerGame.gameId],
    references: [game.id],
  }),
}));

export const characterRelations = relations(character, ({ one, many }) => ({
  player: one(player, {
    fields: [character.playerId],
    references: [player.id],
  }),

  game: one(game, {
    fields: [character.gameId],
    references: [game.id],
  }),

  skills: many(characterSkill),
  items: many(characterItem),
}));

export const skillRelations = relations(skill, ({ many }) => ({
  characters: many(characterSkill),
}));

export const characterSkillRelations = relations(characterSkill, ({ one }) => ({
  character: one(character, {
    fields: [characterSkill.characterId],
    references: [character.id],
  }),

  skill: one(skill, {
    fields: [characterSkill.skillId],
    references: [skill.id],
  }),
}));

export const characterItemRelations = relations(characterItem, ({ one }) => ({
  character: one(character, {
    fields: [characterItem.characterId],
    references: [character.id],
  }),
}));

export const sessionRelations = relations(session, ({ one, many }) => ({
  game: one(game, {
    fields: [session.gameId],
    references: [game.id],
  }),

  logs: many(sessionLog),
  combatState: one(combatState),
  combatants: many(combatant),
}));

export const monsterRelations = relations(monster, ({ one }) => ({
  game: one(game, {
    fields: [monster.gameId],
    references: [game.id],
  }),

  creator: one(player, {
    fields: [monster.createdBy],
    references: [player.id],
  }),
}));

export const combatStateRelations = relations(combatState, ({ one }) => ({
  session: one(session, {
    fields: [combatState.sessionId],
    references: [session.id],
  }),
}));

export const combatantRelations = relations(combatant, ({ one }) => ({
  session: one(session, {
    fields: [combatant.sessionId],
    references: [session.id],
  }),
}));

export const sessionLogRelations = relations(sessionLog, ({ one }) => ({
  session: one(session, {
    fields: [sessionLog.sessionId],
    references: [session.id],
  }),

  player: one(player, {
    fields: [sessionLog.playerId],
    references: [player.id],
  }),
}));
