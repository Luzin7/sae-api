import type { RollKind } from '@shared/dice/roll.js';

export interface ChatMessage {
  id: string;
  sessionId: string;
  playerId: string | null;
  body: string;
  createdAt: Date;
}

/** A player as seen by the wire (`session.state`, `presence`, dice, join). */
export interface PlayerSummary {
  playerId: string;
  name: string;
}

export interface InitiativeEntry {
  playerId: string;
  playerName: string;
  value: number;
}

export interface DiceRolledEvent {
  playerId: string;
  playerName: string;
  skillId: string;
  attribute: string;
  rolls: number[];
  result: number;
  kind: RollKind;
  skillBonus: number;
  bExp: number;
  total: number;
}

/**
 * Bus events. A domain-level side effect the services publish; the gateway maps
 * it to a wire frame. Events are room-scoped, so they carry no socket concerns
 * and no session id (the room already identifies the session).
 */
export type RealtimeEvent =
  | { type: 'presence'; players: PlayerSummary[] }
  | { type: 'session.state'; players: PlayerSummary[] }
  | { type: 'session.player-joined'; player: PlayerSummary }
  | { type: 'session.player-left'; player: PlayerSummary }
  | { type: 'chat.message'; message: ChatMessage }
  | { type: 'dice.rolled'; roll: DiceRolledEvent }
  | {
      type: 'character.hp-changed';
      characterId: string;
      oldHp: number;
      newHp: number;
    }
  | {
      type: 'character.pe-changed';
      characterId: string;
      oldPe: number;
      newPe: number;
    }
  | {
      type: 'master.narration';
      playerId: string;
      playerName: string;
      text: string;
      at: string;
    }
  | { type: 'session.initiative'; order: InitiativeEntry[] };

export function chatRoom(sessionId: string): string {
  return `session:${sessionId}`;
}
