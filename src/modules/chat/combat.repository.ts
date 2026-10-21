import type { CombatStatePayload } from '@modules/session/session.entity.js';
import type { CombatantKind } from './combatant-source.contract.js';

export interface CombatantSeed {
  kind: CombatantKind;
  refId: string;
  name: string;
}

export interface CombatRepository {
  findState(sessionId: string): Promise<CombatStatePayload | null>;
  start(
    sessionId: string,
    combatants: CombatantSeed[],
  ): Promise<CombatStatePayload>;
  rollInitiative(
    sessionId: string,
    kind: CombatantKind,
    refId: string,
    roll: () => number,
  ): Promise<CombatStatePayload>;
  setTurn(
    sessionId: string,
    turnIndex: number,
    round: number,
  ): Promise<CombatStatePayload>;
  end(sessionId: string): Promise<void>;
}
