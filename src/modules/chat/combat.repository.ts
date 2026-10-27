import type { CombatStatePayload } from '@modules/session/session.entity.js';
import type { CombatantKind } from './combatant-source.contract.js';

export interface CombatantSeed {
  kind: CombatantKind;
  refId: string;
  name: string;
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
  rollInitiative(
    sessionId: string,
    kind: CombatantKind,
    refId: string,
    roll: () => number,
    playerId: string | null,
  ): Promise<CombatStatePayload>;
  advanceTurn(input: AdvanceTurnInput): Promise<CombatStatePayload>;
  end(sessionId: string, playerId: string | null): Promise<CombatStatePayload>;
}
