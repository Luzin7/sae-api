import { z } from 'zod';

export interface GameSession {
  id: string;
  gameId: string;
  isActive: boolean;
  startedAt: Date;
  endedAt: Date | null;
}

export interface Page {
  limit: number;
  offset: number;
}

export const DEFAULT_LOG_PAGE: Page = { limit: 50, offset: 0 };

/**
 * Typed payloads per session event. The key set MUST stay in sync with the
 * `event_type` pgEnum in the Drizzle schema: the adapter assigns the row's
 * enum value to `SessionEventType`, so a mismatch fails the build.
 */
export interface DiceRollPayload {
  expression: string;
  results: number[];
  total: number;
}

export interface HpChangePayload {
  characterId: string;
  delta: number;
  currentHp: number;
  maxHp: number;
}

export interface PeChangePayload {
  characterId: string;
  delta: number;
  currentEffort: number;
  maxEffort: number;
}

export interface ChatPayload {
  text: string;
}

export interface PlayerJoinPayload {
  playerId: string;
  name: string;
}

export interface PlayerLeavePayload {
  playerId: string;
  name: string;
}

export interface MasterBroadcastPayload {
  text: string;
}

export interface InitiativeEntryPayload {
  playerId: string;
  playerName: string;
  value: number;
}

export interface InitiativePayload {
  order: InitiativeEntryPayload[];
}

export interface SessionEventPayloadMap {
  dice_roll: DiceRollPayload;
  hp_change: HpChangePayload;
  pe_change: PeChangePayload;
  chat: ChatPayload;
  player_join: PlayerJoinPayload;
  player_leave: PlayerLeavePayload;
  master_broadcast: MasterBroadcastPayload;
  initiative: InitiativePayload;
}

export type SessionEventType = keyof SessionEventPayloadMap;

export type SessionEventPayload = SessionEventPayloadMap[SessionEventType];

export type SessionEvent = {
  [K in SessionEventType]: { eventType: K; payload: SessionEventPayloadMap[K] };
}[SessionEventType];

export const DiceRollPayloadSchema = z.object({
  expression: z.string().min(1),
  results: z.array(z.number().int()),
  total: z.number().int(),
});

export const HpChangePayloadSchema = z.object({
  characterId: z.string().min(1),
  delta: z.number().int(),
  currentHp: z.number().int(),
  maxHp: z.number().int(),
});

export const PeChangePayloadSchema = z.object({
  characterId: z.string().min(1),
  delta: z.number().int(),
  currentEffort: z.number().int(),
  maxEffort: z.number().int(),
});

export const ChatPayloadSchema = z.object({
  text: z.string().min(1),
});

export const PlayerJoinPayloadSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
});

export const PlayerLeavePayloadSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
});

export const MasterBroadcastPayloadSchema = z.object({
  text: z.string().min(1),
});

export const InitiativeEntryPayloadSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  value: z.number().int(),
});

export const InitiativePayloadSchema = z.object({
  order: z.array(InitiativeEntryPayloadSchema),
});

export const SessionEventPayloadSchemas: Record<
  SessionEventType,
  z.ZodType<SessionEventPayload>
> = {
  dice_roll: DiceRollPayloadSchema,
  hp_change: HpChangePayloadSchema,
  pe_change: PeChangePayloadSchema,
  chat: ChatPayloadSchema,
  player_join: PlayerJoinPayloadSchema,
  player_leave: PlayerLeavePayloadSchema,
  master_broadcast: MasterBroadcastPayloadSchema,
  initiative: InitiativePayloadSchema,
};

export function parseSessionEventPayload(
  eventType: SessionEventType,
  payload: unknown,
): SessionEventPayload {
  return SessionEventPayloadSchemas[eventType].parse(payload);
}

export interface SessionLog {
  id: string;
  sessionId: string;
  playerId: string | null;
  eventType: SessionEventType;
  payload: SessionEventPayload;
  createdAt: Date;
}

export type AppendLogInput = {
  [K in SessionEventType]: {
    sessionId: string;
    playerId: string | null;
    eventType: K;
    payload: SessionEventPayloadMap[K];
  };
}[SessionEventType];
