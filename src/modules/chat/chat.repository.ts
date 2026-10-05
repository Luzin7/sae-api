import type { ChatMessage, InitiativeEntry } from './chat.entity.js';

export interface ChatSessionRef {
  id: string;
  gameId: string;
}

export interface DiceRollLogPayload {
  expression: string;
  results: number[];
  total: number;
}

export interface HpChangeLogPayload {
  characterId: string;
  delta: number;
  currentHp: number;
  maxHp: number;
}

export interface PeChangeLogPayload {
  characterId: string;
  delta: number;
  currentEffort: number;
  maxEffort: number;
}

export interface ChatLogPayload {
  text: string;
}

export interface PlayerJoinLogPayload {
  playerId: string;
  name: string;
}

export interface PlayerLeaveLogPayload {
  playerId: string;
  name: string;
}

export interface MasterBroadcastLogPayload {
  text: string;
}

export interface InitiativeLogPayload {
  order: InitiativeEntry[];
}

/**
 * Typed payloads per log event. The key set mirrors the `event_type` pgEnum and
 * the session slice's payload map, so `GET .../logs` can parse every row this
 * slice writes. Extra keys are never added here.
 */
export interface SessionLogPayloadMap {
  dice_roll: DiceRollLogPayload;
  hp_change: HpChangeLogPayload;
  pe_change: PeChangeLogPayload;
  chat: ChatLogPayload;
  player_join: PlayerJoinLogPayload;
  player_leave: PlayerLeaveLogPayload;
  master_broadcast: MasterBroadcastLogPayload;
  initiative: InitiativeLogPayload;
}

export type SessionLogEventType = keyof SessionLogPayloadMap;

export type AppendSessionLogInput = {
  [K in SessionLogEventType]: {
    sessionId: string;
    playerId: string | null;
    eventType: K;
    payload: SessionLogPayloadMap[K];
  };
}[SessionLogEventType];

export interface AppendChatMessageInput {
  sessionId: string;
  playerId: string;
  body: string;
}

/**
 * I/O seam over `session_log`. The adapter is the only file that touches the
 * table; the slice never imports `session`.
 */
export interface ChatMessageRepository {
  findSession(sessionId: string): Promise<ChatSessionRef | null>;
  appendChat(input: AppendChatMessageInput): Promise<ChatMessage>;
  appendLog(input: AppendSessionLogInput): Promise<void>;
  listRecentChat(sessionId: string, limit: number): Promise<ChatMessage[]>;
}
