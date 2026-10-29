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
  afflictions: string[];
}

export interface MonsterTemplate {
  attributes: Record<AttributeKey, number>;
  currentHp: number;
  maxHp: number;
  currentEffort: number;
  maxEffort: number;
}

interface CombatantRefBase {
  refId: string;
  name: string;
  ownerPlayerId: string | null;
}

export interface CharacterRef extends CombatantRefBase {
  kind: 'character';
}

export interface MonsterCombatantRef extends CombatantRefBase {
  kind: 'monster';
  template?: MonsterTemplate;
}

export type CombatantRef = CharacterRef | MonsterCombatantRef;

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
}
