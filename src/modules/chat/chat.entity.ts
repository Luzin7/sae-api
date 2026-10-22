import type {
  CombatStatePayload,
  TestDeclaredPayload,
} from '@modules/session/session.entity.js';
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

/** A connected player in the session roster, with their characters in the game. */
export interface PlayerPresence {
  playerId: string;
  name: string;
  characterIds: string[];
}

/** Connected session roster. The master is never duplicated inside `players`. */
export interface PresenceSnapshot {
  master: PlayerSummary | null;
  players: PlayerPresence[];
}

export interface InitiativeEntry {
  playerId: string;
  playerName: string;
  value: number;
}

export interface DiceRolledEvent {
  playerId: string;
  playerName: string;
  characterId: string;
  skillId: string;
  attribute: string;
  rolls: number[];
  result: number;
  kind: RollKind;
  skillBonus: number;
  bExp: number;
  total: number;
  testId?: string;
  cd?: number;
  success?: boolean;
  declaredSkillId?: string;
  grade?: number;
}

export interface OpenTestSnapshot extends TestDeclaredPayload {
  rolledCharacterIds: string[];
}

/**
 * Bus events. A domain-level side effect the services publish; the gateway maps
 * it to a wire frame. Events are room-scoped, so they carry no socket concerns
 * and no session id (the room already identifies the session).
 */
export type RealtimeEvent =
  | ({ type: 'presence' } & PresenceSnapshot)
  | ({ type: 'session.state' } & PresenceSnapshot)
  | { type: 'session.player-joined'; player: PlayerPresence }
  | { type: 'session.player-left'; player: PlayerPresence }
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
  | { type: 'session.combat'; state: CombatStatePayload }
  | { type: 'session.test-declared'; test: TestDeclaredPayload }
  | { type: 'session.test-closed'; testId: string }
  | {
      type: 'session.monster-rolled';
      monsterId: string;
      name: string;
      attribute: string;
      rolls: number[];
      result: number;
      kind: RollKind;
    }
  | {
      type: 'session.monster-vitals';
      monsterId: string;
      currentHp: number;
      maxHp: number;
      currentEffort: number;
      maxEffort: number;
    }
  | {
      type: 'session.monster-attacked';
      monsterId: string;
      name: string;
      attribute: string;
      targetCharacterId: string;
      targetName: string;
      rolls: number[];
      result: number;
      kind: RollKind;
      damage: number;
    };

export function chatRoom(sessionId: string): string {
  return `session:${sessionId}`;
}
