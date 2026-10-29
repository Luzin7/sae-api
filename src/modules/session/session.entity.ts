import { z } from 'zod';
import type { AttributeKey } from '@shared/rules/attributes.js';

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
  testId?: string;
  cd?: number;
  success?: boolean;
  characterId?: string;
  skillId?: string;
  declaredSkillId?: string;
  grade?: number;
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

export interface CombatantPayload {
  combatantId: string;
  kind: 'character' | 'monster';
  refId: string;
  name: string;
  initiativeValue: number | null;
  hasRolled: boolean;
  currentHp: number | null;
  maxHp: number | null;
  currentEffort: number | null;
  maxEffort: number | null;
  afflictions: string[];
  cognition: number | null;
  psyche: number | null;
  instinct: number | null;
  constitution: number | null;
  motricity: number | null;
  perception: number | null;
}

export function combatantAttributes(
  entry: CombatantPayload,
): Record<AttributeKey, number> | null {
  if (
    entry.cognition === null ||
    entry.psyche === null ||
    entry.instinct === null ||
    entry.constitution === null ||
    entry.motricity === null ||
    entry.perception === null
  ) {
    return null;
  }

  return {
    cognition: entry.cognition,
    psyche: entry.psyche,
    instinct: entry.instinct,
    constitution: entry.constitution,
    motricity: entry.motricity,
    perception: entry.perception,
  };
}

export interface CombatStatePayload {
  active: boolean;
  turnIndex: number;
  round: number;
  entries: CombatantPayload[];
}

export interface TestDeclaredPayload {
  testId: string;
  skillId: string;
  grade?: number;
  cd: number;
  mode: 'open' | 'targeted';
  targetCharacterId: string | null;
  targetName: string | null;
}

export interface TestClosedPayload {
  testId: string;
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
  combat_state: CombatStatePayload;
  test_declared: TestDeclaredPayload;
  test_closed: TestClosedPayload;
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
  testId: z.string().min(1).optional(),
  cd: z.number().int().optional(),
  success: z.boolean().optional(),
  characterId: z.string().min(1).optional(),
  skillId: z.string().min(1).optional(),
  declaredSkillId: z.string().min(1).optional(),
  grade: z.number().int().optional(),
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

export const CombatantPayloadSchema = z.object({
  combatantId: z.string().min(1),
  kind: z.enum(['character', 'monster']),
  refId: z.string().min(1),
  name: z.string().min(1),
  initiativeValue: z.number().int().nullable(),
  hasRolled: z.boolean(),
  currentHp: z.number().int().nullish().default(null),
  maxHp: z.number().int().nullish().default(null),
  currentEffort: z.number().int().nullish().default(null),
  maxEffort: z.number().int().nullish().default(null),
  afflictions: z.array(z.string()).default([]),
  cognition: z.number().int().nullish().default(null),
  psyche: z.number().int().nullish().default(null),
  instinct: z.number().int().nullish().default(null),
  constitution: z.number().int().nullish().default(null),
  motricity: z.number().int().nullish().default(null),
  perception: z.number().int().nullish().default(null),
});

export const CombatStatePayloadSchema = z.object({
  active: z.boolean(),
  turnIndex: z.number().int(),
  round: z.number().int(),
  entries: z.array(CombatantPayloadSchema),
});

export const TestDeclaredPayloadSchema = z.object({
  testId: z.string().min(1),
  skillId: z.string().min(1),
  grade: z.number().int().optional(),
  cd: z.number().int(),
  mode: z.enum(['open', 'targeted']),
  targetCharacterId: z.string().min(1).nullable(),
  targetName: z.string().min(1).nullable(),
});

export const TestClosedPayloadSchema = z.object({
  testId: z.string().min(1),
});

export const SessionEventPayloadSchemas: Record<
  SessionEventType,
  z.ZodType<SessionEventPayload, z.ZodTypeDef, unknown>
> = {
  dice_roll: DiceRollPayloadSchema,
  hp_change: HpChangePayloadSchema,
  pe_change: PeChangePayloadSchema,
  chat: ChatPayloadSchema,
  player_join: PlayerJoinPayloadSchema,
  player_leave: PlayerLeavePayloadSchema,
  master_broadcast: MasterBroadcastPayloadSchema,
  initiative: InitiativePayloadSchema,
  combat_state: CombatStatePayloadSchema,
  test_declared: TestDeclaredPayloadSchema,
  test_closed: TestClosedPayloadSchema,
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
