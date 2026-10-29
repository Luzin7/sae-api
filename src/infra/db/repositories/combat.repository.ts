import { and, eq, inArray, sql } from 'drizzle-orm';
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
  AdvanceTurnResult,
  CharacterEffortRecovery,
  ChangeInstanceEffortInput,
  ChangeInstanceHpInput,
  CombatRepository,
  CombatantSeed,
  InstanceEffortChange,
  InstanceHpChange,
  SetInstanceAfflictionsInput,
} from '@modules/chat/combat.repository.js';
import { pickUniqueValue } from '@shared/dice/initiative.js';
import { systemRng } from '@shared/dice/random.js';
import { applyHpChange } from '@shared/rules/hp.js';
import {
  applyEffortChange,
  recoverEffortOnTurnAdvance,
  type EffortHolder,
} from '@shared/rules/effort.js';
import { db, type Database } from '../index.js';
import { character, combatant, combatState } from '../schema.js';
import { insertSessionLog, type Transaction } from './session-log.js';

const MAX_FACES = 20;

type CombatStateRow = typeof combatState.$inferSelect;
type CombatantRow = typeof combatant.$inferSelect;

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

function combatantKey(kind: CombatantKind, refId: string): string {
  return `${kind}:${refId}`;
}

export function planCombatants(
  existing: CombatantRow[],
  seeds: CombatantSeed[],
): {
  remove: string[];
  insert: CombatantSeed[];
  rename: { id: string; name: string }[];
} {
  const seedByKey = new Map(
    seeds.map((seed) => [combatantKey(seed.kind, seed.refId), seed]),
  );
  const existingKeys = new Set(
    existing.map((row) => combatantKey(row.kind, row.refId)),
  );

  const remove: string[] = [];
  const rename: { id: string; name: string }[] = [];
  for (const row of existing) {
    const seed = seedByKey.get(combatantKey(row.kind, row.refId));
    if (!seed) {
      if (row.kind === 'character') remove.push(row.id);
      continue;
    }
    if (seed.name !== row.name) rename.push({ id: row.id, name: seed.name });
  }

  const insert = seeds.filter(
    (seed) => !existingKeys.has(combatantKey(seed.kind, seed.refId)),
  );

  return { remove, insert, rename };
}

export function assignMonsterRolls(
  rows: CombatantRow[],
  seeds: CombatantSeed[],
  roll: () => number,
): { id: string; value: number }[] {
  const rowByKey = new Map(
    rows.map((row) => [combatantKey(row.kind, row.refId), row]),
  );
  const taken = rows
    .filter((row) => row.hasRolled && row.initiativeValue !== null)
    .map((row) => row.initiativeValue as number);

  const assigned: { id: string; value: number }[] = [];
  for (const seed of seeds) {
    if (seed.kind !== 'monster') continue;
    const row = rowByKey.get(combatantKey(seed.kind, seed.refId));
    if (!row || row.hasRolled) continue;

    const value = pickUniqueValue(taken, roll);
    taken.push(value);
    assigned.push({ id: row.id, value });
  }

  return assigned;
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

interface LockedInstance {
  currentEffort: number;
  maxEffort: number;
  currentHp: number;
  maxHp: number;
}

interface InstanceChange<R> {
  next: { currentEffort: number; currentHp: number; afflictions?: string[] };
  result: R;
}

function toLockedInstance(row: CombatantRow): LockedInstance {
  if (
    row.currentEffort === null ||
    row.maxEffort === null ||
    row.currentHp === null ||
    row.maxHp === null
  ) {
    throw new CombatantNotFoundError();
  }

  return {
    currentEffort: row.currentEffort,
    maxEffort: row.maxEffort,
    currentHp: row.currentHp,
    maxHp: row.maxHp,
  };
}

/**
 * Locks combat_state then the monster instance row (the same order as the
 * turn advance), applies the decided change and logs the new combat state.
 */
async function changeLockedInstance<R>(
  database: Database,
  input: { sessionId: string; monsterId: string; playerId: string },
  decide: (instance: LockedInstance) => InstanceChange<R>,
): Promise<{ state: CombatStatePayload; result: R }> {
  return database.transaction(async (tx) => {
    const [state] = await tx
      .select()
      .from(combatState)
      .where(eq(combatState.sessionId, input.sessionId))
      .for('update');
    if (!state) throw new CombatStateNotFoundError();

    const [target] = await tx
      .select()
      .from(combatant)
      .where(
        and(
          eq(combatant.sessionId, input.sessionId),
          eq(combatant.kind, 'monster'),
          eq(combatant.refId, input.monsterId),
        ),
      )
      .for('update');
    if (!target) throw new CombatantNotFoundError();

    const decided = decide(toLockedInstance(target));
    await tx
      .update(combatant)
      .set(decided.next)
      .where(eq(combatant.id, target.id));

    const rows = await tx
      .select()
      .from(combatant)
      .where(eq(combatant.sessionId, input.sessionId));
    const next = toState(state, rows);
    await insertSessionLog(tx, {
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'combat_state',
      payload: next,
    });

    return { state: next, result: decided.result };
  });
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

export function turnAfterRemoval(
  position: { turnIndex: number; round: number },
  removedAt: number,
  totalBefore: number,
): { turnIndex: number; round: number } {
  const remaining = totalBefore - 1;
  if (remaining <= 0 || removedAt > position.turnIndex) return position;
  if (removedAt < position.turnIndex) {
    return { turnIndex: position.turnIndex - 1, round: position.round };
  }

  const wrapping = position.turnIndex >= remaining;

  return wrapping ? { turnIndex: 0, round: position.round + 1 } : position;
}

export async function removeCharacterCombatants(
  tx: Transaction,
  characterId: string,
): Promise<void> {
  const removed = await tx
    .select()
    .from(combatant)
    .where(
      and(eq(combatant.kind, 'character'), eq(combatant.refId, characterId)),
    );

  for (const target of removed) {
    const [state] = await tx
      .select()
      .from(combatState)
      .where(eq(combatState.sessionId, target.sessionId))
      .for('update');

    const rows = await tx
      .select()
      .from(combatant)
      .where(eq(combatant.sessionId, target.sessionId));
    const removedAt = orderEntries(rows).findIndex(
      (entry) => entry.combatantId === target.id,
    );
    await tx.delete(combatant).where(eq(combatant.id, target.id));
    if (!state) continue;

    const position = turnAfterRemoval(state, removedAt, rows.length);
    const [updated] = await tx
      .update(combatState)
      .set({ ...position, updatedAt: new Date() })
      .where(eq(combatState.sessionId, target.sessionId))
      .returning();
    if (!updated) continue;

    await insertSessionLog(tx, {
      sessionId: target.sessionId,
      playerId: null,
      eventType: 'combat_state',
      payload: toState(
        updated,
        rows.filter((row) => row.id !== target.id),
      ),
    });
  }
}

interface TurnRecovery {
  rows: CombatantRow[];
  recovered: CharacterEffortRecovery[];
}

async function recoverTurnEffort(
  tx: Transaction,
  rows: CombatantRow[],
  startingId: string,
): Promise<TurnRecovery> {
  const characterIds = rows
    .filter((row) => row.kind === 'character')
    .map((row) => row.refId);
  const characterHolders: EffortHolder[] =
    characterIds.length === 0
      ? []
      : await tx
          .select({ id: character.id, currentEffort: character.currentEffort })
          .from(character)
          .where(inArray(character.id, characterIds))
          .orderBy(character.id)
          .for('update');
  const monsterHolders: EffortHolder[] = rows
    .filter((row) => row.kind === 'monster' && row.currentEffort !== null)
    .map((row) => ({ id: row.id, currentEffort: row.currentEffort as number }));

  const characterRecoveries = recoverEffortOnTurnAdvance(
    characterHolders,
    startingId,
  );
  for (const recovery of characterRecoveries) {
    await tx
      .update(character)
      .set({
        currentEffort: recovery.newEffort,
        version: sql`${character.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(character.id, recovery.id));
  }

  const monsterEfforts = new Map<string, number>();
  for (const recovery of recoverEffortOnTurnAdvance(
    monsterHolders,
    startingId,
  )) {
    await tx
      .update(combatant)
      .set({ currentEffort: recovery.newEffort })
      .where(eq(combatant.id, recovery.id));
    monsterEfforts.set(recovery.id, recovery.newEffort);
  }

  return {
    rows: rows.map((row) =>
      monsterEfforts.has(row.id)
        ? { ...row, currentEffort: monsterEfforts.get(row.id) ?? null }
        : row,
    ),
    recovered: characterRecoveries.map((recovery) => ({
      characterId: recovery.id,
      oldEffort: recovery.oldEffort,
      newEffort: recovery.newEffort,
    })),
  };
}

function startingCombatantId(rows: CombatantRow[], turnIndex: number): string {
  const starting = orderEntries(rows)[turnIndex];

  return starting?.kind === 'character'
    ? starting.refId
    : (starting?.combatantId ?? '');
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
      roll: () => number,
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
            set: { active: true, updatedAt: new Date() },
          })
          .returning();
        if (!state) throw new CombatStateNotFoundError();

        await tx
          .select()
          .from(combatState)
          .where(eq(combatState.sessionId, sessionId))
          .for('update');

        const existing = await tx
          .select()
          .from(combatant)
          .where(eq(combatant.sessionId, sessionId));
        const plan = planCombatants(existing, seeds);

        if (plan.remove.length > 0) {
          await tx.delete(combatant).where(inArray(combatant.id, plan.remove));
        }
        for (const change of plan.rename) {
          await tx
            .update(combatant)
            .set({ name: change.name })
            .where(eq(combatant.id, change.id));
        }
        if (plan.insert.length > 0) {
          await tx
            .insert(combatant)
            .values(plan.insert.map((seed) => toSeed(sessionId, seed)));
        }

        const rows = await tx
          .select()
          .from(combatant)
          .where(eq(combatant.sessionId, sessionId));

        const assignments = assignMonsterRolls(rows, seeds, roll);
        for (const assignment of assignments) {
          await tx
            .update(combatant)
            .set({ initiativeValue: assignment.value, hasRolled: true })
            .where(eq(combatant.id, assignment.id));
        }

        const persisted = await tx
          .select()
          .from(combatant)
          .where(eq(combatant.sessionId, sessionId));

        const next = toState(state, persisted);
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

        const persisted = await tx
          .select()
          .from(combatant)
          .where(eq(combatant.sessionId, sessionId));

        const next = toState(state, persisted);
        await insertSessionLog(tx, {
          sessionId,
          playerId,
          eventType: 'combat_state',
          payload: next,
        });

        return next;
      });
    },

    async advanceTurn(input: AdvanceTurnInput): Promise<AdvanceTurnResult> {
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
        if (stale) return { state: toState(state, rows), recovered: [] };

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

        const recovery = await recoverTurnEffort(
          tx,
          rows,
          startingCombatantId(rows, updated.turnIndex),
        );
        const next = toState(updated, recovery.rows);
        await insertSessionLog(tx, {
          sessionId: input.sessionId,
          playerId: input.playerId,
          eventType: 'combat_state',
          payload: next,
        });

        return { state: next, recovered: recovery.recovered };
      });
    },

    async changeInstanceEffort(
      input: ChangeInstanceEffortInput,
    ): Promise<InstanceEffortChange> {
      const { state, result } = await changeLockedInstance(
        database,
        input,
        (instance) => {
          const applied = applyEffortChange(
            {
              currentEffort: instance.currentEffort,
              effortLimit: instance.maxEffort,
              currentHp: instance.currentHp,
            },
            input.delta,
          );

          return {
            next: {
              currentEffort: applied.currentEffort,
              currentHp: applied.currentHp,
            },
            result: {
              oldEffort: instance.currentEffort,
              newEffort: applied.currentEffort,
              oldHp: instance.currentHp,
              newHp: applied.currentHp,
            },
          };
        },
      );

      return { state, ...result };
    },

    async changeInstanceHp(
      input: ChangeInstanceHpInput,
    ): Promise<InstanceHpChange> {
      const { state, result } = await changeLockedInstance(
        database,
        input,
        (instance) => {
          const { currentHp } = applyHpChange(
            { currentHp: instance.currentHp, maxHp: instance.maxHp },
            input.delta,
          );

          return {
            next: { currentEffort: instance.currentEffort, currentHp },
            result: { oldHp: instance.currentHp, newHp: currentHp },
          };
        },
      );

      return { state, ...result };
    },

    async setInstanceAfflictions(
      input: SetInstanceAfflictionsInput,
    ): Promise<{ state: CombatStatePayload }> {
      const { state } = await changeLockedInstance(
        database,
        input,
        (instance) => ({
          next: {
            currentEffort: instance.currentEffort,
            currentHp: instance.currentHp,
            afflictions: [...input.afflictions],
          },
          result: null,
        }),
      );

      return { state };
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
