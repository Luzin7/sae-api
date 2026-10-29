import type { CombatStatePayload } from '@modules/session/session.entity.js';
import type { CombatantKind } from './combatant-source.contract.js';

export interface CombatantSeed {
  kind: CombatantKind;
  refId: string;
  name: string;
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

/**
 * The turn the caller believes it is advancing from. A concurrent call with
 * the same expected turn is a no-op instead of a second advance.
 */
export interface AdvanceTurnInput {
  sessionId: string;
  playerId: string | null;
  expectedTurnIndex: number;
  expectedRound: number;
}

export interface InstanceVitalsPatch {
  currentHp: number;
  currentEffort: number;
  afflictions?: string[];
}

/**
 * Every state change writes its `combat_state` log row inside the same
 * transaction, so a failed log never leaves an unlogged turn behind.
 * `playerId` is the actor recorded in that row.
 */
export interface CombatRepository {
  findState(sessionId: string): Promise<CombatStatePayload | null>;
  start(
    sessionId: string,
    combatants: CombatantSeed[],
    playerId: string | null,
  ): Promise<CombatStatePayload>;
  addCombatant(
    sessionId: string,
    seed: CombatantSeed,
    playerId: string | null,
  ): Promise<CombatStatePayload>;
  rollInitiative(
    sessionId: string,
    kind: CombatantKind,
    refId: string,
    roll: () => number,
    playerId: string | null,
  ): Promise<CombatStatePayload>;
  advanceTurn(input: AdvanceTurnInput): Promise<CombatStatePayload>;
  saveInstanceVitals(
    sessionId: string,
    monsterId: string,
    patch: InstanceVitalsPatch,
    playerId: string,
  ): Promise<void>;
  end(sessionId: string, playerId: string | null): Promise<CombatStatePayload>;
}
