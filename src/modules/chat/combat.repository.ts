import type { CombatStatePayload } from '@modules/session/session.entity.js';
import type { AfflictionKey } from '@shared/rules/afflictions.js';
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

export interface CharacterEffortRecovery {
  characterId: string;
  oldEffort: number;
  newEffort: number;
}

/** `recovered` lists only characters whose PE dropped; empty for a stale frame. */
export interface AdvanceTurnResult {
  state: CombatStatePayload;
  recovered: CharacterEffortRecovery[];
}

export interface ChangeInstanceEffortInput {
  sessionId: string;
  monsterId: string;
  delta: number;
  playerId: string;
}

export interface InstanceEffortChange {
  state: CombatStatePayload;
  oldEffort: number;
  newEffort: number;
  oldHp: number;
  newHp: number;
}

export interface ChangeInstanceHpInput {
  sessionId: string;
  monsterId: string;
  delta: number;
  playerId: string;
}

export interface SetInstanceAfflictionsInput {
  sessionId: string;
  monsterId: string;
  afflictions: AfflictionKey[];
  playerId: string;
}

export interface InstanceHpChange {
  state: CombatStatePayload;
  oldHp: number;
  newHp: number;
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
    roll: () => number,
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
  /**
   * On an actual advance, every combatant with PE except the one whose turn
   * starts loses 1 PE inside the same transaction.
   */
  advanceTurn(input: AdvanceTurnInput): Promise<AdvanceTurnResult>;
  /** Locks the instance row and applies the PE rule to its effort and HP. */
  changeInstanceEffort(
    input: ChangeInstanceEffortInput,
  ): Promise<InstanceEffortChange>;
  /** Locks the instance row and clamps its PS to 0..maxHp after the delta. */
  changeInstanceHp(input: ChangeInstanceHpInput): Promise<InstanceHpChange>;
  /** Replaces the afflictions list of the locked monster instance row. */
  setInstanceAfflictions(
    input: SetInstanceAfflictionsInput,
  ): Promise<{ state: CombatStatePayload }>;
  end(sessionId: string, playerId: string | null): Promise<CombatStatePayload>;
}
