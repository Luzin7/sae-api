import type { Rng } from '@shared/dice/roll.js';
import { pickUniqueValue } from '@shared/dice/initiative.js';
import { systemRng } from '@shared/dice/random.js';
import { vi } from 'vitest';
import type { CharacterAccess } from './character-access.contract.js';
import type { ChatMessageRepository } from './chat.repository.js';
import type {
  AdvanceTurnInput,
  ChangeInstanceEffortInput,
  ChangeInstanceHpInput,
  SetInstanceAfflictionsInput,
  CombatantSeed,
  CombatRepository,
} from './combat.repository.js';
import {
  CombatantNotFoundError,
  CombatNotReadyError,
  CombatStateNotFoundError,
} from './chat.errors.js';
import type {
  CombatantKind,
  CombatantRef,
  CombatantSource,
} from './combatant-source.contract.js';
import { applyHpChange } from '@shared/rules/hp.js';
import {
  applyEffortChange,
  recoverEffortOnTurnAdvance,
} from '@shared/rules/effort.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';
import type {
  CombatStatePayload,
  CombatantPayload,
} from '@modules/session/session.entity.js';

export function makeChatMessages(): ChatMessageRepository {
  return {
    findSession: vi.fn(),
    appendChat: vi.fn(),
    appendLog: vi.fn(),
    listRecentChat: vi.fn(),
    findTestById: vi.fn(),
    findLatestTest: vi.fn(),
    isTestClosed: vi.fn(),
    hasRolledTest: vi.fn(),
    listTestRollers: vi.fn(),
  };
}

export function makeGameAccess(): GameAccess {
  return { findById: vi.fn(), isMember: vi.fn(), mastersAnyGame: vi.fn() };
}

export function makeCombatants(): CombatantSource {
  return {
    listByGame: vi.fn(),
    findByRef: vi.fn(),
    findMonsterInGame: vi.fn(),
  };
}

export function makeCombat(): CombatRepository {
  return {
    findState: vi.fn(),
    start: vi.fn(),
    addCombatant: vi.fn(),
    rollInitiative: vi.fn(),
    advanceTurn: vi.fn(),
    changeInstanceEffort: vi.fn(),
    changeInstanceHp: vi.fn(),
    setInstanceAfflictions: vi.fn(),
    end: vi.fn(),
  };
}

export function makeCharacterAccess(): CharacterAccess {
  return {
    findById: vi.fn(),
    findSkillById: vi.fn(),
    findSkillForCharacter: vi.fn(),
    changeHp: vi.fn(),
    changeEffort: vi.fn(),
  };
}

export interface DirectoryCharacter {
  playerId: string;
  id: string;
  createdAt: string;
}

export function directoryCharacter(
  playerId: string,
  id: string,
  createdAt = '2024-01-01T00:00:00.000Z',
): DirectoryCharacter {
  return { playerId, id, createdAt };
}

function byCreatedAtThenId(a: DirectoryCharacter, b: DirectoryCharacter) {
  const delta = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (delta !== 0) return delta;

  return a.id.localeCompare(b.id);
}

export function makePlayerDirectory(
  names: Record<string, string> = {},
  characters: DirectoryCharacter[] = [],
): PlayerDirectory {
  return {
    findById: vi.fn(async (playerId: string) => {
      const name = names[playerId];
      if (name === undefined) return null;

      return { id: playerId, name };
    }),
    findCharactersByGame: vi.fn(async () => {
      const byPlayer = new Map<string, string[]>();
      for (const item of [...characters].sort(byCreatedAtThenId)) {
        const ids = byPlayer.get(item.playerId) ?? [];
        ids.push(item.id);
        byPlayer.set(item.playerId, ids);
      }

      return byPlayer;
    }),
  };
}

/** RNG that always rolls the same d20 face. */
export function fixedRng(value: number): Rng {
  return () => value;
}

/** RNG that walks a fixed sequence, repeating the last value forever. */
export function sequenceRng(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 1;
    index += 1;

    return value;
  };
}

export function makeInMemoryCombatants(refs: CombatantRef[]): CombatantSource {
  return {
    async listByGame() {
      return refs;
    },
    async findByRef(_gameId: string, kind: CombatantKind, refId: string) {
      return (
        refs.find((ref) => ref.kind === kind && ref.refId === refId) ?? null
      );
    },
    async findMonsterInGame() {
      return null;
    },
  };
}

export interface InMemoryCombatantRow {
  id: string;
  kind: CombatantKind;
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
  createdAt: Date;
}

export interface InMemoryCombat extends CombatRepository {
  rows(): InMemoryCombatantRow[];
}

function combatantKey(kind: CombatantKind, refId: string): string {
  return `${kind}:${refId}`;
}

export function makeInMemoryCombat(
  logs?: ChatMessageRepository,
): InMemoryCombat {
  const state = new Map<
    string,
    { active: boolean; turnIndex: number; round: number }
  >();
  const combatants = new Map<string, InMemoryCombatantRow[]>();
  let counter = 0;

  function entries(sessionId: string): CombatantPayload[] {
    const rows = combatants.get(sessionId) ?? [];

    return [...rows]
      .sort((a, b) => {
        if (a.hasRolled !== b.hasRolled) return a.hasRolled ? -1 : 1;
        if (a.hasRolled && b.hasRolled) {
          return (b.initiativeValue ?? 0) - (a.initiativeValue ?? 0);
        }

        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .map((row) => ({
        combatantId: row.id,
        kind: row.kind,
        refId: row.refId,
        name: row.name,
        initiativeValue: row.initiativeValue,
        hasRolled: row.hasRolled,
        currentHp: row.currentHp,
        maxHp: row.maxHp,
        currentEffort: row.currentEffort,
        maxEffort: row.maxEffort,
        afflictions: [...row.afflictions],
        cognition: row.cognition,
        psyche: row.psyche,
        instinct: row.instinct,
        constitution: row.constitution,
        motricity: row.motricity,
        perception: row.perception,
      }));
  }

  function payload(sessionId: string) {
    const current = state.get(sessionId);
    if (!current) return null;

    return { ...current, entries: entries(sessionId) };
  }

  async function writeLog(
    sessionId: string,
    playerId: string | null,
    current: CombatStatePayload,
  ): Promise<void> {
    await logs?.appendLog({
      sessionId,
      playerId,
      eventType: 'combat_state',
      payload: current,
    });
  }

  return {
    rows() {
      return [...combatants.values()].flat();
    },

    async findState(sessionId: string) {
      return payload(sessionId);
    },

    async start(
      sessionId: string,
      seeds: CombatantSeed[],
      roll: () => number,
      playerId: string | null,
    ) {
      const running = state.get(sessionId);
      state.set(sessionId, {
        active: true,
        turnIndex: running?.turnIndex ?? 0,
        round: running?.round ?? 1,
      });

      const previous = combatants.get(sessionId) ?? [];
      const byKey = new Map(
        previous.map((row) => [combatantKey(row.kind, row.refId), row]),
      );
      const instances = previous.filter(
        (row) =>
          row.kind === 'monster' &&
          !seeds.some(
            (seed) => seed.kind === 'monster' && seed.refId === row.refId,
          ),
      );
      const next = seeds.map((seed) => {
        const kept = byKey.get(combatantKey(seed.kind, seed.refId));
        if (kept) {
          kept.name = seed.name;

          return kept;
        }

        counter += 1;

        return {
          id: `c-${counter}`,
          kind: seed.kind,
          refId: seed.refId,
          name: seed.name,
          initiativeValue: null,
          hasRolled: false,
          currentHp: seed.currentHp,
          maxHp: seed.maxHp,
          currentEffort: seed.currentEffort,
          maxEffort: seed.maxEffort,
          afflictions: [...seed.afflictions],
          cognition: seed.cognition,
          psyche: seed.psyche,
          instinct: seed.instinct,
          constitution: seed.constitution,
          motricity: seed.motricity,
          perception: seed.perception,
          createdAt: new Date(2024, 0, 1, 0, 0, counter),
        };
      });
      next.push(...instances);
      combatants.set(sessionId, next);

      const taken = next
        .filter((row) => row.hasRolled && row.initiativeValue !== null)
        .map((row) => row.initiativeValue as number);
      for (const seed of seeds) {
        if (seed.kind !== 'monster') continue;
        const row = next.find(
          (item) => item.kind === seed.kind && item.refId === seed.refId,
        );
        if (!row || row.hasRolled) continue;

        const value = pickUniqueValue(taken, roll);
        taken.push(value);
        row.initiativeValue = value;
        row.hasRolled = true;
      }

      const current = payload(sessionId)!;
      await writeLog(sessionId, playerId, current);

      return current;
    },

    async addCombatant(
      sessionId: string,
      seed: CombatantSeed,
      playerId: string | null,
    ) {
      const current = state.get(sessionId);
      if (!current?.active) throw new CombatStateNotFoundError();

      const rows = combatants.get(sessionId) ?? [];
      const exists = rows.some(
        (row) => row.kind === seed.kind && row.refId === seed.refId,
      );
      if (exists) return payload(sessionId)!;

      const taken = rows
        .filter((item) => item.hasRolled && item.initiativeValue !== null)
        .map((item) => item.initiativeValue as number);
      let value = systemRng(1, 20);
      for (let attempt = 0; attempt < 20 && taken.includes(value); attempt++) {
        value = systemRng(1, 20);
      }

      counter += 1;
      rows.push({
        id: `c-${counter}`,
        kind: seed.kind,
        refId: seed.refId,
        name: seed.name,
        initiativeValue: value,
        hasRolled: true,
        currentHp: seed.currentHp,
        maxHp: seed.maxHp,
        currentEffort: seed.currentEffort,
        maxEffort: seed.maxEffort,
        afflictions: [...seed.afflictions],
        cognition: seed.cognition,
        psyche: seed.psyche,
        instinct: seed.instinct,
        constitution: seed.constitution,
        motricity: seed.motricity,
        perception: seed.perception,
        createdAt: new Date(2024, 0, 1, 0, 0, counter),
      });
      combatants.set(sessionId, rows);

      const next = payload(sessionId)!;
      await writeLog(sessionId, playerId, next);

      return next;
    },

    async rollInitiative(
      sessionId: string,
      kind: CombatantKind,
      refId: string,
      roll: () => number,
      playerId: string | null,
    ) {
      const rows = combatants.get(sessionId) ?? [];
      const target = rows.find(
        (item) => item.kind === kind && item.refId === refId,
      );
      if (!target) throw new CombatantNotFoundError();

      if (target.hasRolled) return payload(sessionId)!;

      const taken = rows
        .filter((item) => item.hasRolled && item.initiativeValue !== null)
        .map((item) => item.initiativeValue as number);
      const value = pickUniqueValue(taken, roll);
      target.initiativeValue = value;
      target.hasRolled = true;

      const current = payload(sessionId)!;
      await writeLog(sessionId, playerId, current);

      return current;
    },

    async advanceTurn(input: AdvanceTurnInput) {
      const current = state.get(input.sessionId);
      if (!current?.active) throw new CombatStateNotFoundError();

      const rows = combatants.get(input.sessionId) ?? [];
      if (rows.length === 0) throw new CombatNotReadyError();
      if (rows.some((row) => !row.hasRolled)) throw new CombatNotReadyError();

      const stale =
        current.turnIndex !== input.expectedTurnIndex ||
        current.round !== input.expectedRound;
      if (stale) return { state: payload(input.sessionId)!, recovered: [] };

      const wrapping = current.turnIndex + 1 >= rows.length;
      state.set(input.sessionId, {
        active: true,
        turnIndex: wrapping ? 0 : current.turnIndex + 1,
        round: wrapping ? current.round + 1 : current.round,
      });

      const starting = entries(input.sessionId)[
        state.get(input.sessionId)!.turnIndex
      ]!;
      const monsters = rows.filter(
        (row) => row.kind === 'monster' && row.currentEffort !== null,
      );
      for (const recovery of recoverEffortOnTurnAdvance(
        monsters.map((row) => ({
          id: row.id,
          currentEffort: row.currentEffort as number,
        })),
        starting.combatantId,
      )) {
        monsters.find((row) => row.id === recovery.id)!.currentEffort =
          recovery.newEffort;
      }

      const next = payload(input.sessionId)!;
      await writeLog(input.sessionId, input.playerId, next);

      return { state: next, recovered: [] };
    },

    async changeInstanceEffort(input: ChangeInstanceEffortInput) {
      if (!state.get(input.sessionId)) throw new CombatStateNotFoundError();

      const target = (combatants.get(input.sessionId) ?? []).find(
        (row) => row.kind === 'monster' && row.refId === input.monsterId,
      );
      if (
        !target ||
        target.currentEffort === null ||
        target.maxEffort === null ||
        target.currentHp === null
      ) {
        throw new CombatantNotFoundError();
      }

      const oldEffort = target.currentEffort;
      const oldHp = target.currentHp;
      const applied = applyEffortChange(
        {
          currentEffort: oldEffort,
          effortLimit: target.maxEffort,
          currentHp: oldHp,
        },
        input.delta,
      );
      target.currentEffort = applied.currentEffort;
      target.currentHp = applied.currentHp;

      const next = payload(input.sessionId)!;
      await writeLog(input.sessionId, input.playerId, next);

      return {
        state: next,
        oldEffort,
        newEffort: applied.currentEffort,
        oldHp,
        newHp: applied.currentHp,
      };
    },

    async changeInstanceHp(input: ChangeInstanceHpInput) {
      if (!state.get(input.sessionId)) throw new CombatStateNotFoundError();

      const target = (combatants.get(input.sessionId) ?? []).find(
        (row) => row.kind === 'monster' && row.refId === input.monsterId,
      );
      if (!target || target.currentHp === null || target.maxHp === null) {
        throw new CombatantNotFoundError();
      }

      const oldHp = target.currentHp;
      target.currentHp = applyHpChange(
        { currentHp: oldHp, maxHp: target.maxHp },
        input.delta,
      ).currentHp;

      const next = payload(input.sessionId)!;
      await writeLog(input.sessionId, input.playerId, next);

      return { state: next, oldHp, newHp: target.currentHp };
    },

    async setInstanceAfflictions(input: SetInstanceAfflictionsInput) {
      if (!state.get(input.sessionId)) throw new CombatStateNotFoundError();

      const target = (combatants.get(input.sessionId) ?? []).find(
        (row) => row.kind === 'monster' && row.refId === input.monsterId,
      );
      if (!target) throw new CombatantNotFoundError();

      target.afflictions = [...input.afflictions];

      const next = payload(input.sessionId)!;
      await writeLog(input.sessionId, input.playerId, next);

      return { state: next };
    },

    async end(sessionId: string, playerId: string | null) {
      combatants.delete(sessionId);
      state.delete(sessionId);

      const ended: CombatStatePayload = {
        active: false,
        turnIndex: 0,
        round: 1,
        entries: [],
      };
      await writeLog(sessionId, playerId, ended);

      return ended;
    },
  };
}
