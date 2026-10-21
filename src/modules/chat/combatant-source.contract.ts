import type { AttributeKey } from '@shared/rules/attributes.js';

export type CombatantKind = 'character' | 'monster';

export interface MonsterRef {
  id: string;
  name: string;
  attributes: Record<AttributeKey, number>;
  currentHp: number;
  maxHp: number;
  currentEffort: number;
  maxEffort: number;
}

export interface CombatantRef {
  kind: CombatantKind;
  refId: string;
  name: string;
  ownerPlayerId: string | null;
}

export interface CombatantSource {
  listByGame(gameId: string): Promise<CombatantRef[]>;
  findByRef(
    gameId: string,
    kind: CombatantKind,
    refId: string,
  ): Promise<CombatantRef | null>;
  findMonsterInGame(
    gameId: string,
    monsterId: string,
  ): Promise<MonsterRef | null>;
  saveMonsterVitals(
    monsterId: string,
    patch: { currentHp: number; currentEffort: number },
  ): Promise<void>;
}
