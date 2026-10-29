import { eq, sql } from 'drizzle-orm';
import type { AppendSessionLogInput } from '@modules/chat/chat.repository.js';
import { applyEffortChange } from '@shared/rules/effort.js';
import { applyHpChange } from '@shared/rules/hp.js';
import type { Database } from '../index.js';
import { character } from '../schema.js';
import { insertSessionLog } from './session-log.js';

export type CharacterRow = typeof character.$inferSelect;

export interface VitalsLogContext {
  sessionId: string;
  playerId: string;
}

interface LockedVitals {
  id: string;
  currentEffort: number;
  maxEffort: number;
  currentHp: number;
  maxHp: number;
}

export interface VitalsChangePlan {
  next: { currentEffort: number; currentHp: number };
  changed: boolean;
  logs: AppendSessionLogInput[];
}

export interface LockedVitalsChange {
  row: CharacterRow;
  oldEffort: number;
  oldHp: number;
}

export function planEffortChange(
  vitals: LockedVitals,
  delta: number,
  log: VitalsLogContext | null,
): VitalsChangePlan {
  const applied = applyEffortChange(
    {
      currentEffort: vitals.currentEffort,
      effortLimit: vitals.maxEffort,
      currentHp: vitals.currentHp,
    },
    delta,
  );
  const effortDelta = applied.currentEffort - vitals.currentEffort;
  const hpDelta = applied.currentHp - vitals.currentHp;
  const logs: AppendSessionLogInput[] = [];

  if (log && effortDelta !== 0) {
    logs.push({
      ...log,
      eventType: 'pe_change',
      payload: {
        characterId: vitals.id,
        delta: effortDelta,
        currentEffort: applied.currentEffort,
        maxEffort: vitals.maxEffort,
      },
    });
  }
  if (log && hpDelta !== 0) {
    logs.push({
      ...log,
      eventType: 'hp_change',
      payload: {
        characterId: vitals.id,
        delta: hpDelta,
        currentHp: applied.currentHp,
        maxHp: vitals.maxHp,
      },
    });
  }

  return {
    next: {
      currentEffort: applied.currentEffort,
      currentHp: applied.currentHp,
    },
    changed: effortDelta !== 0 || hpDelta !== 0,
    logs,
  };
}

export function planHpChange(
  vitals: LockedVitals,
  delta: number,
  log: VitalsLogContext | null,
): VitalsChangePlan {
  const { currentHp } = applyHpChange(vitals, delta);
  const hpDelta = currentHp - vitals.currentHp;
  const logs: AppendSessionLogInput[] =
    log && hpDelta !== 0
      ? [
          {
            ...log,
            eventType: 'hp_change',
            payload: {
              characterId: vitals.id,
              delta: hpDelta,
              currentHp,
              maxHp: vitals.maxHp,
            },
          },
        ]
      : [];

  return {
    next: { currentEffort: vitals.currentEffort, currentHp },
    changed: hpDelta !== 0,
    logs,
  };
}

/** Plans from the locked row, so concurrent changes never overwrite each other. */
async function applyLockedChange(
  database: Database,
  characterId: string,
  plan: (locked: CharacterRow) => VitalsChangePlan,
): Promise<LockedVitalsChange | null> {
  return database.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(character)
      .where(eq(character.id, characterId))
      .for('update');
    if (!locked) return null;

    const decided = plan(locked);
    const unchanged = {
      row: locked,
      oldEffort: locked.currentEffort,
      oldHp: locked.currentHp,
    };
    if (!decided.changed) return unchanged;

    const [row] = await tx
      .update(character)
      .set({
        currentEffort: decided.next.currentEffort,
        currentHp: decided.next.currentHp,
        version: sql`${character.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(character.id, characterId))
      .returning();
    if (!row) return null;

    for (const entry of decided.logs) await insertSessionLog(tx, entry);

    return { ...unchanged, row };
  });
}

export function changeLockedCharacterEffort(
  database: Database,
  characterId: string,
  delta: number,
  log: VitalsLogContext | null,
): Promise<LockedVitalsChange | null> {
  return applyLockedChange(database, characterId, (locked) =>
    planEffortChange(locked, delta, log),
  );
}

export function changeLockedCharacterHp(
  database: Database,
  characterId: string,
  delta: number,
  log: VitalsLogContext | null,
): Promise<LockedVitalsChange | null> {
  return applyLockedChange(database, characterId, (locked) =>
    planHpChange(locked, delta, log),
  );
}
