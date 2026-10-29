import { and, eq } from 'drizzle-orm';
import type {
  CombatStatePayload,
  CombatantPayload,
} from '@modules/session/session.entity.js';
import type { CombatantKind } from '@modules/chat/combatant-source.contract.js';
import {
  CombatantNotFoundError,
  CombatNotReadyError,
  CombatStateNotFoundError,
} from '@modules/chat/chat.errors.js';
import type {
  AdvanceTurnInput,
  CombatRepository,
  CombatantSeed,
  InstanceVitalsPatch,
} from '@modules/chat/combat.repository.js';
import { systemRng } from '@shared/dice/random.js';
import { db, type Database } from '../index.js';
import { combatant, combatState } from '../schema.js';
import { insertSessionLog } from './session-log.js';

type CombatStateRow = typeof combatState.$inferSelect;
type CombatantRow = typeof combatant.$inferSelect;

const MAX_FACES = 20;

function toEntry(row: CombatantRow): CombatantPayload {
  return {
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
    afflictions: row.afflictions ?? [],
    cognition: row.cognition,
    psyche: row.psyche,
    instinct: row.instinct,
    constitution: row.constitution,
    motricity: row.motricity,
    perception: row.perception,
  };
}

export function pickUniqueValue(taken: number[], roll: () => number): number {
  for (let attempt = 0; attempt < MAX_FACES; attempt++) {
    const value = roll();
    if (!taken.includes(value)) return value;
  }
  for (let value = 1; value <= MAX_FACES; value++) {
    if (!taken.includes(value)) return value;
  }

  return roll();
}

export function orderEntries(rows: CombatantRow[]): CombatantPayload[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.hasRolled !== b.hasRolled) return a.hasRolled ? -1 : 1;
    if (a.hasRolled && b.hasRolled) {
      const diff = (b.initiativeValue ?? 0) - (a.initiativeValue ?? 0);
      if (diff !== 0) return diff;
    }

    const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
    if (byCreatedAt !== 0) return byCreatedAt;

    return a.id.localeCompare(b.id);
  });

  return sorted.map(toEntry);
}

function toState(
  state: CombatStateRow,
  rows: CombatantRow[],
): CombatStatePayload {
  return {
    active: state.active,
    turnIndex: state.turnIndex,
    round: state.round,
    entries: orderEntries(rows),
  };
}

async function readState(
  database: Database,
  sessionId: string,
): Promise<CombatStatePayload | null> {
  const [state] = await database
    .select()
    .from(combatState)
    .where(eq(combatState.sessionId, sessionId))
    .limit(1);
  if (!state) return null;

  const rows = await database
    .select()
    .from(combatant)
    .where(eq(combatant.sessionId, sessionId));

  return toState(state, rows);
}

function ensureCanAdvance(state: CombatStateRow, rows: CombatantRow[]): void {
  if (!state.active) throw new CombatStateNotFoundError();
  if (rows.length === 0) throw new CombatNotReadyError();
  if (rows.some((row) => !row.hasRolled)) throw new CombatNotReadyError();
}

function takenValues(rows: CombatantRow[]): number[] {
  return rows
    .filter((row) => row.hasRolled && row.initiativeValue !== null)
    .map((row) => row.initiativeValue as number);
}

function vitalsPatch(patch: InstanceVitalsPatch): {
  currentHp: number;
  currentEffort: number;
  afflictions?: string[];
} {
  const values: {
    currentHp: number;
    currentEffort: number;
    afflictions?: string[];
  } = { currentHp: patch.currentHp, currentEffort: patch.currentEffort };
  if (patch.afflictions !== undefined) {
    values.afflictions = [...patch.afflictions];
  }

  return values;
}

function nextTurnPosition(
  turnIndex: number,
  round: number,
  total: number,
): { turnIndex: number; round: number } {
  const wrapping = turnIndex + 1 >= total;

  return wrapping
    ? { turnIndex: 0, round: round + 1 }
    : { turnIndex: turnIndex + 1, round };
}

function toSeed(sessionId: string, seed: CombatantSeed) {
  return {
    sessionId,
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
  };
}

export function combatRepository(database: Database = db): CombatRepository {
  return {
    async findState(sessionId: string): Promise<CombatStatePayload | null> {
      return readState(database, sessionId);
    },

    async start(
      sessionId: string,
      seeds: CombatantSeed[],
      playerId: string | null,
    ): Promise<CombatStatePayload> {
      return database.transaction(async (tx) => {
        const [state] = await tx
          .insert(combatState)
          .values({
            sessionId,
            active: true,
            turnIndex: 0,
            round: 1,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: combatState.sessionId,
            set: {
              active: true,
              turnIndex: 0,
              round: 1,
              updatedAt: new Date(),
            },
          })
          .returning();
        if (!state) throw new CombatStateNotFoundError();

        await tx
          .select()
          .from(combatState)
          .where(eq(combatState.sessionId, sessionId))
          .for('update');

        await tx.delete(combatant).where(eq(combatant.sessionId, sessionId));
        if (seeds.length > 0) {
          await tx
            .insert(combatant)
            .values(seeds.map((seed) => toSeed(sessionId, seed)));
        }

        const rows = await tx
          .select()
          .from(combatant)
          .where(eq(combatant.sessionId, sessionId));

        const next = toState(state, rows);
        await insertSessionLog(tx, {
          sessionId,
          playerId,
          eventType: 'combat_state',
          payload: next,
        });

        return next;
      });
    },

    async addCombatant(
      sessionId: string,
      seed: CombatantSeed,
      playerId: string | null,
    ): Promise<CombatStatePayload> {
      return database.transaction(async (tx) => {
        const [state] = await tx
          .select()
          .from(combatState)
          .where(eq(combatState.sessionId, sessionId))
          .for('update');
        if (!state?.active) throw new CombatStateNotFoundError();

        const rows = await tx
          .select()
          .from(combatant)
          .where(eq(combatant.sessionId, sessionId));

        const initiativeValue = pickUniqueValue(takenValues(rows), () =>
          systemRng(1, MAX_FACES),
        );
        const [inserted] = await tx
          .insert(combatant)
          .values({
            ...toSeed(sessionId, seed),
            initiativeValue,
            hasRolled: true,
          })
          .onConflictDoNothing({
            target: [combatant.sessionId, combatant.kind, combatant.refId],
          })
          .returning();

        const fresh = await tx
          .select()
          .from(combatant)
          .where(eq(combatant.sessionId, sessionId));
        const next = toState(state, fresh);

        if (!inserted) return next;

        await insertSessionLog(tx, {
          sessionId,
          playerId,
          eventType: 'combat_state',
          payload: next,
        });

        return next;
      });
    },

    async rollInitiative(
      sessionId: string,
      kind: CombatantKind,
      refId: string,
      roll: () => number,
      playerId: string | null,
    ): Promise<CombatStatePayload> {
      return database.transaction(async (tx) => {
        const [state] = await tx
          .select()
          .from(combatState)
          .where(eq(combatState.sessionId, sessionId))
          .for('update');
        if (!state) throw new CombatStateNotFoundError();

        const rows = await tx
          .select()
          .from(combatant)
          .where(eq(combatant.sessionId, sessionId));
        const target = rows.find(
          (row) => row.kind === kind && row.refId === refId,
        );
        if (!target) throw new CombatantNotFoundError();
        if (target.hasRolled) return toState(state, rows);

        const taken = takenValues(rows);
        const value = pickUniqueValue(taken, roll);

        const [updated] = await tx
          .update(combatant)
          .set({ initiativeValue: value, hasRolled: true })
          .where(eq(combatant.id, target.id))
          .returning();
        if (!updated) throw new CombatantNotFoundError();

        const fresh = rows.map((row) =>
          row.id === target.id
            ? { ...row, initiativeValue: value, hasRolled: true }
            : row,
        );

        const next = toState(state, fresh);
        await insertSessionLog(tx, {
          sessionId,
          playerId,
          eventType: 'combat_state',
          payload: next,
        });

        return next;
      });
    },

    async advanceTurn(input: AdvanceTurnInput): Promise<CombatStatePayload> {
      return database.transaction(async (tx) => {
        const [state] = await tx
          .select()
          .from(combatState)
          .where(eq(combatState.sessionId, input.sessionId))
          .for('update');
        if (!state) throw new CombatStateNotFoundError();

        const rows = await tx
          .select()
          .from(combatant)
          .where(eq(combatant.sessionId, input.sessionId));
        ensureCanAdvance(state, rows);

        const stale =
          state.turnIndex !== input.expectedTurnIndex ||
          state.round !== input.expectedRound;
        if (stale) return toState(state, rows);

        const { turnIndex, round } = nextTurnPosition(
          state.turnIndex,
          state.round,
          rows.length,
        );
        const [updated] = await tx
          .update(combatState)
          .set({ turnIndex, round, updatedAt: new Date() })
          .where(eq(combatState.sessionId, input.sessionId))
          .returning();
        if (!updated) throw new CombatStateNotFoundError();

        const next = toState(updated, rows);
        await insertSessionLog(tx, {
          sessionId: input.sessionId,
          playerId: input.playerId,
          eventType: 'combat_state',
          payload: next,
        });

        return next;
      });
    },

    async saveInstanceVitals(
      sessionId: string,
      monsterId: string,
      patch: InstanceVitalsPatch,
      playerId: string,
    ): Promise<void> {
      await database.transaction(async (tx) => {
        const [state] = await tx
          .select()
          .from(combatState)
          .where(eq(combatState.sessionId, sessionId))
          .for('update');
        if (!state) throw new CombatStateNotFoundError();

        const [updated] = await tx
          .update(combatant)
          .set(vitalsPatch(patch))
          .where(
            and(
              eq(combatant.sessionId, sessionId),
              eq(combatant.kind, 'monster'),
              eq(combatant.refId, monsterId),
            ),
          )
          .returning();
        if (!updated) throw new CombatantNotFoundError();

        const rows = await tx
          .select()
          .from(combatant)
          .where(eq(combatant.sessionId, sessionId));

        await insertSessionLog(tx, {
          sessionId,
          playerId,
          eventType: 'combat_state',
          payload: toState(state, rows),
        });
      });
    },

    async end(
      sessionId: string,
      playerId: string | null,
    ): Promise<CombatStatePayload> {
      return database.transaction(async (tx) => {
        await tx
          .select()
          .from(combatState)
          .where(eq(combatState.sessionId, sessionId))
          .for('update');
        await tx.delete(combatant).where(eq(combatant.sessionId, sessionId));
        await tx
          .delete(combatState)
          .where(eq(combatState.sessionId, sessionId));

        const state: CombatStatePayload = {
          active: false,
          turnIndex: 0,
          round: 1,
          entries: [],
        };
        await insertSessionLog(tx, {
          sessionId,
          playerId,
          eventType: 'combat_state',
          payload: state,
        });

        return state;
      });
    },
  };
}
