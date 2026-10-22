import type { Rng } from '@shared/dice/roll.js';
import { vi } from 'vitest';
import type { CharacterAccess } from './character-access.contract.js';
import type { ChatMessageRepository } from './chat.repository.js';
import type {
  AdvanceTurnInput,
  CombatantSeed,
  CombatRepository,
} from './combat.repository.js';
import {
  CombatNotReadyError,
  CombatStateNotFoundError,
} from './chat.errors.js';
import type {
  CombatantKind,
  CombatantRef,
  CombatantSource,
} from './combatant-source.contract.js';
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
  return { findById: vi.fn(), isMember: vi.fn() };
}

export function makeCombatants(): CombatantSource {
  return {
    listByGame: vi.fn(),
    findByRef: vi.fn(),
    findMonsterInGame: vi.fn(),
    saveMonsterVitals: vi.fn(),
  };
}

export function makeCombat(): CombatRepository {
  return {
    findState: vi.fn(),
    start: vi.fn(),
    rollInitiative: vi.fn(),
    advanceTurn: vi.fn(),
    end: vi.fn(),
  };
}

export function makeCharacterAccess(): CharacterAccess {
  return {
    findById: vi.fn(),
    findSkillById: vi.fn(),
    findSkillForCharacter: vi.fn(),
    updateHpWithLog: vi.fn(),
    damageHp: vi.fn(),
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
export function sequenceRng(values: number[]): Rng {
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
    async saveMonsterVitals() {
      return undefined;
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
  createdAt: Date;
}

export interface InMemoryCombat extends CombatRepository {
  rows(): InMemoryCombatantRow[];
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
      playerId: string | null,
    ) {
      state.set(sessionId, { active: true, turnIndex: 0, round: 1 });
      combatants.set(
        sessionId,
        seeds.map((seed) => {
          counter += 1;

          return {
            id: `c-${counter}`,
            kind: seed.kind,
            refId: seed.refId,
            name: seed.name,
            initiativeValue: null,
            hasRolled: false,
            createdAt: new Date(2024, 0, 1, 0, 0, counter),
          };
        }),
      );

      const current = payload(sessionId)!;
      await writeLog(sessionId, playerId, current);

      return current;
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
      if (!target) throw new Error('missing');

      if (target.hasRolled) return payload(sessionId)!;

      const taken = rows
        .filter((item) => item.hasRolled && item.initiativeValue !== null)
        .map((item) => item.initiativeValue as number);
      let value = roll();
      for (let attempt = 0; attempt < 20 && taken.includes(value); attempt++) {
        value = roll();
      }
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
      if (stale) return payload(input.sessionId)!;

      const wrapping = current.turnIndex + 1 >= rows.length;
      state.set(input.sessionId, {
        active: true,
        turnIndex: wrapping ? 0 : current.turnIndex + 1,
        round: wrapping ? current.round + 1 : current.round,
      });

      const next = payload(input.sessionId)!;
      await writeLog(input.sessionId, input.playerId, next);

      return next;
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
