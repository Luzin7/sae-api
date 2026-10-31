import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Database } from '@infra/db/index.js';
import { combatRepository } from '@infra/db/repositories/combat.repository.js';
import type { CombatantSeed } from './combat.repository.js';
import { CombatNotReadyError } from './chat.errors.js';
import { makeInMemoryCombat } from './chat.testkit.js';

const SEEDS: CombatantSeed[] = [
  {
    kind: 'character',
    refId: 'char-1',
    name: 'Ana',
    currentHp: null,
    maxHp: null,
    currentEffort: null,
    maxEffort: null,
    afflictions: [],
    cognition: null,
    psyche: null,
    instinct: null,
    constitution: null,
    motricity: null,
    perception: null,
  },
  {
    kind: 'monster',
    refId: 'mon-1',
    name: 'Goblin',
    currentHp: 10,
    maxHp: 10,
    currentEffort: 5,
    maxEffort: 5,
    afflictions: [],
    cognition: 2,
    psyche: -2,
    instinct: 0,
    constitution: 3,
    motricity: 1,
    perception: 0,
  },
];

const PLAYER_ID = 'p-1';

async function advance(
  combat: ReturnType<typeof makeInMemoryCombat>,
  turn: number,
) {
  const { state } = await combat.advanceTurn({
    sessionId: 's-1',
    playerId: PLAYER_ID,
    expectedTurnIndex: turn,
    expectedRound: 1,
  });

  return state;
}

function value(
  state: { entries: { refId: string; initiativeValue: number | null }[] },
  refId: string,
): number | null {
  return (
    state.entries.find((entry) => entry.refId === refId)?.initiativeValue ??
    null
  );
}

describe('CombatRepository contract (in-memory fake)', () => {
  it('re-rolling an already rolled combatant is idempotent', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, () => 20, PLAYER_ID);

    const first = await combat.rollInitiative(
      's-1',
      'character',
      'char-1',
      () => 9,
      PLAYER_ID,
    );
    const second = await combat.rollInitiative(
      's-1',
      'character',
      'char-1',
      () => 20,
      PLAYER_ID,
    );

    expect(value(first, 'char-1')).toBe(9);
    expect(value(second, 'char-1')).toBe(9);
  });

  it('end removes the combatants so no orphans remain', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, () => 20, PLAYER_ID);

    await combat.end('s-1', PLAYER_ID);

    await expect(combat.findState('s-1')).resolves.toBeNull();
    expect(combat.rows()).toHaveLength(0);
  });

  it('advanceTurn refuses while a combatant has not rolled', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, () => 20, PLAYER_ID);

    await expect(advance(combat, 0)).rejects.toBeInstanceOf(
      CombatNotReadyError,
    );
  });
});

type Row = Record<string, unknown>;

interface FakeCombatDatabaseOptions {
  active?: boolean;
  combatants?: Row[];
  holdCombatantReads?: number;
}

interface FakeSelect {
  where(): FakeSelect;
  for(kind: string): FakeSelect;
  limit(count: number): FakeSelect;
  then(
    onFulfilled?: (rows: Row[]) => unknown,
    onRejected?: (error: unknown) => unknown,
  ): Promise<unknown>;
  catch(onRejected?: (error: unknown) => unknown): Promise<unknown>;
  finally(onFinally?: () => void): Promise<unknown>;
}

interface FakeInsert {
  values(value: Row | Row[]): FakeInsert;
  onConflictDoNothing(): { returning(): Promise<Row[]> };
  returning(): Promise<Row[]>;
  then(
    onFulfilled?: (rows: Row[]) => unknown,
    onRejected?: (error: unknown) => unknown,
  ): Promise<unknown>;
  catch(onRejected?: (error: unknown) => unknown): Promise<unknown>;
  finally(onFinally?: () => void): Promise<unknown>;
}

interface FakeUpdate {
  set(values: Row): FakeUpdate;
  where(condition: unknown): FakeUpdate;
  returning(): Promise<Row[]>;
  then(
    onFulfilled?: (rows: Row[]) => unknown,
    onRejected?: (error: unknown) => unknown,
  ): Promise<unknown>;
  catch(onRejected?: (error: unknown) => unknown): Promise<unknown>;
  finally(onFinally?: () => void): Promise<unknown>;
}

const MONSTER_SEED: CombatantSeed = {
  kind: 'monster',
  refId: 'mon-1',
  name: 'Goblin',
  currentHp: 10,
  maxHp: 10,
  currentEffort: 5,
  maxEffort: 5,
  afflictions: [],
  cognition: 2,
  psyche: -2,
  instinct: 0,
  constitution: 3,
  motricity: 1,
  perception: 0,
};

function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
}

interface SqlChunk {
  queryChunks?: unknown[];
  value?: unknown;
  encoder?: unknown;
  config?: { name?: string };
}

function collectConditions(node: unknown, found: [string, unknown][]): void {
  const chunks = (node as SqlChunk | null)?.queryChunks;
  if (!chunks) return;

  let column: string | null = null;
  for (const chunk of chunks) {
    const sql = chunk as SqlChunk;
    if (sql.queryChunks) {
      collectConditions(sql, found);
      continue;
    }
    if (sql.config?.name) {
      column = sql.config.name;
      continue;
    }
    if (column !== null && sql.encoder !== undefined) {
      found.push([snakeToCamel(column), sql.value]);
      column = null;
    }
  }
}

class UnparsedConditionError extends Error {
  constructor() {
    super('the fake could not parse the update condition');
    this.name = 'UnparsedConditionError';
  }
}

/** Column/value pairs of the `eq`/`and` condition the repository passes to `where`. */
function conditions(node: unknown): [string, unknown][] {
  const found: [string, unknown][] = [];
  collectConditions(node, found);
  if (found.length === 0) {
    throw new UnparsedConditionError();
  }

  return found;
}

/**
 * A Drizzle-shaped fake. Selects return the stored rows, inserts honour the
 * `combatant_session_kind_ref_unique` key under `onConflictDoNothing`, and
 * `session_log` writes record whether they happened inside a transaction.
 */
function fakeCombatDatabase(options: FakeCombatDatabaseOptions = {}) {
  const store: Record<string, Row[]> = {
    combat_state:
      options.active === false
        ? []
        : [
            {
              sessionId: 's-1',
              active: true,
              turnIndex: 0,
              round: 1,
              updatedAt: new Date(),
            },
          ],
    combatant: [...(options.combatants ?? [])],
  };
  const logs: Row[] = [];
  const holdCombatantReads = options.holdCombatantReads ?? 0;
  let combatantReads = 0;
  let inTransaction = false;
  let counter = 0;
  let openGate = (): void => {};
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });

  function selectChain(table: unknown): FakeSelect {
    const name = getTableName(table as never);
    let limit: number | null = null;

    async function read(): Promise<Row[]> {
      if (name === 'combatant') {
        combatantReads += 1;
        if (combatantReads <= holdCombatantReads) {
          if (combatantReads === holdCombatantReads) openGate();
          await gate;
        }
      }

      const rows = [...(store[name] ?? [])];

      return limit === null ? rows : rows.slice(0, limit);
    }

    const chain: FakeSelect = {
      where: () => chain,
      for: () => chain,
      limit: (count: number) => {
        limit = count;
        return chain;
      },
      then: (onFulfilled, onRejected) => read().then(onFulfilled, onRejected),
      catch: (onRejected) => read().catch(onRejected),
      finally: (onFinally) => read().finally(onFinally),
    };

    return chain;
  }

  function insertChain(table: unknown): FakeInsert {
    const name = getTableName(table as never);
    let incoming: Row[] = [];

    function isConflict(row: Row): boolean {
      return (store.combatant ?? []).some(
        (existing) =>
          existing.sessionId === row.sessionId &&
          existing.kind === row.kind &&
          existing.refId === row.refId,
      );
    }

    function commit(skipConflicts: boolean): Row[] {
      const inserted: Row[] = [];
      for (const value of incoming) {
        if (skipConflicts && isConflict(value)) continue;

        if (name === 'session_log') {
          logs.push({ ...value, inTransaction });
          inserted.push(value);
          continue;
        }

        counter += 1;
        const target = store[name] ?? [];
        const row: Row = {
          id: `c-${counter}`,
          createdAt: new Date(2024, 0, 1, 0, 0, counter),
          ...value,
        };
        target.push(row);
        store[name] = target;
        inserted.push(row);
      }

      return inserted;
    }

    const chain: FakeInsert = {
      values: (value) => {
        incoming = Array.isArray(value) ? value : [value];
        return chain;
      },
      onConflictDoNothing: () => ({
        returning: () => Promise.resolve(commit(true)),
      }),
      returning: () => Promise.resolve(commit(false)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(commit(false)).then(onFulfilled, onRejected),
      catch: (onRejected) => Promise.resolve(commit(false)).catch(onRejected),
      finally: (onFinally) => Promise.resolve(commit(false)).finally(onFinally),
    };

    return chain;
  }

  function updateChain(table: unknown): FakeUpdate {
    const name = getTableName(table as never);
    let patch: Row = {};
    let predicate: [string, unknown][] = [];

    function apply(): Promise<Row[]> {
      const target = store[name] ?? [];
      const matched = target.filter((row) =>
        predicate.every(([column, value]) => row[column] === value),
      );
      for (const row of matched) Object.assign(row, patch);

      return Promise.resolve(matched);
    }

    const chain: FakeUpdate = {
      set: (values) => {
        patch = values;
        return chain;
      },
      where: (condition) => {
        predicate = conditions(condition);
        return chain;
      },
      returning: () => apply(),
      then: (onFulfilled, onRejected) => apply().then(onFulfilled, onRejected),
      catch: (onRejected) => apply().catch(onRejected),
      finally: (onFinally) => apply().finally(onFinally),
    };

    return chain;
  }

  const database = {
    transaction: async (run: (tx: unknown) => unknown) => {
      inTransaction = true;
      try {
        return await run(database);
      } finally {
        inTransaction = false;
      }
    },
    select: () => ({ from: selectChain }),
    insert: insertChain,
    update: updateChain,
  } as unknown as Database;

  return { database, logs, combatants: () => store.combatant ?? [] };
}

describe('combatRepository (database)', () => {
  it('addCombatant returns the freshly read state when the insert conflicts', async () => {
    const fake = fakeCombatDatabase({ holdCombatantReads: 2 });
    const combat = combatRepository(fake.database);

    const [first, second] = await Promise.all([
      combat.addCombatant('s-1', MONSTER_SEED, PLAYER_ID),
      combat.addCombatant('s-1', MONSTER_SEED, PLAYER_ID),
    ]);

    expect(first.entries).toHaveLength(1);
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0]).toMatchObject({
      kind: 'monster',
      refId: 'mon-1',
    });
    expect(fake.combatants()).toHaveLength(1);
  });
});
