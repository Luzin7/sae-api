import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Database } from '@infra/db/index.js';
import { combatRepository } from '@infra/db/repositories/combat.repository.js';
import type { CombatantSeed } from './combat.repository.js';
import {
  CombatantNotFoundError,
  CombatNotReadyError,
  CombatStateNotFoundError,
} from './chat.errors.js';
import {
  makeChatMessages,
  makeInMemoryCombat,
  sequenceRng,
} from './chat.testkit.js';

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

function advance(combat: ReturnType<typeof makeInMemoryCombat>, turn: number) {
  return combat.advanceTurn({
    sessionId: 's-1',
    playerId: PLAYER_ID,
    expectedTurnIndex: turn,
    expectedRound: 1,
  });
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

async function rolledCombat() {
  const combat = makeInMemoryCombat();
  await combat.start('s-1', SEEDS, () => 20, PLAYER_ID);
  await combat.rollInitiative('s-1', 'character', 'char-1', () => 9, PLAYER_ID);

  return combat;
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

  it('start rolls the monsters and leaves the characters unrolled', async () => {
    const combat = makeInMemoryCombat();

    const state = await combat.start('s-1', SEEDS, () => 14, PLAYER_ID);

    const monster = state.entries.find((entry) => entry.refId === 'mon-1');
    const character = state.entries.find((entry) => entry.refId === 'char-1');
    expect(monster?.hasRolled).toBe(true);
    expect(monster?.initiativeValue).toBe(14);
    expect(character?.hasRolled).toBe(false);
    expect(character?.initiativeValue).toBeNull();
  });

  it('start replaces the roster without leaving duplicates', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, () => 20, PLAYER_ID);

    const state = await combat.start('s-1', SEEDS, () => 20, PLAYER_ID);

    expect(state.entries).toHaveLength(2);
    expect(state.entries.map((entry) => entry.refId).sort()).toEqual([
      'char-1',
      'mon-1',
    ]);
  });

  it('start twice keeps monster values and player rolls', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, sequenceRng([7]), PLAYER_ID);
    await combat.rollInitiative(
      's-1',
      'character',
      'char-1',
      () => 18,
      PLAYER_ID,
    );

    const state = await combat.start(
      's-1',
      SEEDS,
      sequenceRng([3, 4]),
      PLAYER_ID,
    );

    expect(value(state, 'mon-1')).toBe(7);
    expect(value(state, 'char-1')).toBe(18);
  });

  it('start deduplicates a new monster against a preserved player value', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, sequenceRng([11]), PLAYER_ID);
    await combat.rollInitiative(
      's-1',
      'character',
      'char-1',
      () => 14,
      PLAYER_ID,
    );

    const state = await combat.start(
      's-1',
      [
        ...SEEDS,
        {
          kind: 'monster',
          refId: 'mon-2',
          name: 'Orc',
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
      ],
      sequenceRng([14, 6]),
      PLAYER_ID,
    );

    expect(value(state, 'mon-1')).toBe(11);
    expect(value(state, 'char-1')).toBe(14);
    expect(value(state, 'mon-2')).toBe(6);
  });

  it('end removes the combatants so no orphans remain', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, () => 20, PLAYER_ID);

    await combat.end('s-1', PLAYER_ID);

    await expect(combat.findState('s-1')).resolves.toBeNull();
    expect(combat.rows()).toHaveLength(0);
  });

  it('advanceTurn wraps the round after the last combatant', async () => {
    const combat = await rolledCombat();

    const first = await advance(combat, 0);
    const second = await advance(combat, 1);

    expect(first.turnIndex).toBe(1);
    expect(second.turnIndex).toBe(0);
    expect(second.round).toBe(2);
  });

  it('advanceTurn ignores a turn already advanced past the expected index', async () => {
    const combat = await rolledCombat();
    await advance(combat, 0);

    const state = await advance(combat, 0);

    expect(state.turnIndex).toBe(1);
  });

  it('advanceTurn refuses while a combatant has not rolled', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, () => 20, PLAYER_ID);

    await expect(advance(combat, 0)).rejects.toBeInstanceOf(
      CombatNotReadyError,
    );
  });

  it('writes the combat_state log only when the turn actually moves', async () => {
    const messages = makeChatMessages();
    const combat = makeInMemoryCombat(messages);
    await combat.start('s-1', SEEDS, () => 20, PLAYER_ID);
    await combat.rollInitiative(
      's-1',
      'character',
      'char-1',
      () => 9,
      PLAYER_ID,
    );
    await combat.rollInitiative('s-1', 'monster', 'mon-1', () => 15, PLAYER_ID);
    const before = (
      messages.appendLog as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;

    await advance(combat, 0);
    await advance(combat, 0);

    const calls = (
      messages.appendLog as unknown as { mock: { calls: unknown[] } }
    ).mock.calls.length;
    expect(calls - before).toBe(1);
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

function monsterRow(overrides: Row = {}): Row {
  return {
    id: 'c-1',
    sessionId: 's-1',
    kind: 'monster',
    refId: 'mon-1',
    name: 'Goblin',
    initiativeValue: 12,
    hasRolled: true,
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
    createdAt: new Date(2024, 0, 1),
    ...overrides,
  };
}

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

  it('saveInstanceVitals writes the combat_state log in the same transaction', async () => {
    const fake = fakeCombatDatabase({ combatants: [monsterRow()] });
    const combat = combatRepository(fake.database);

    await combat.saveInstanceVitals(
      's-1',
      'mon-1',
      {
        currentHp: 7,
        currentEffort: 3,
      },
      PLAYER_ID,
    );

    expect(fake.logs).toHaveLength(1);
    expect(fake.logs[0]).toMatchObject({
      sessionId: 's-1',
      playerId: PLAYER_ID,
      eventType: 'combat_state',
      inTransaction: true,
    });
    expect(fake.logs[0]?.payload).toMatchObject({
      active: true,
      entries: [expect.objectContaining({ currentHp: 7, currentEffort: 3 })],
    });
  });

  it('saveInstanceVitals throws when no combatant matches', async () => {
    const fake = fakeCombatDatabase({ combatants: [] });
    const combat = combatRepository(fake.database);

    await expect(
      combat.saveInstanceVitals(
        's-1',
        'mon-1',
        {
          currentHp: 7,
          currentEffort: 3,
        },
        PLAYER_ID,
      ),
    ).rejects.toBeInstanceOf(CombatantNotFoundError);
    expect(fake.logs).toHaveLength(0);
  });

  it('saveInstanceVitals throws when no combat state row matches', async () => {
    const fake = fakeCombatDatabase({
      active: false,
      combatants: [monsterRow()],
    });
    const combat = combatRepository(fake.database);

    await expect(
      combat.saveInstanceVitals(
        's-1',
        'mon-1',
        { currentHp: 7, currentEffort: 3 },
        PLAYER_ID,
      ),
    ).rejects.toBeInstanceOf(CombatStateNotFoundError);
    expect(fake.combatants()[0]).toMatchObject({
      currentHp: 10,
      currentEffort: 5,
    });
    expect(fake.logs).toHaveLength(0);
  });

  it('saveInstanceVitals keeps the afflictions when the patch omits them', async () => {
    const fake = fakeCombatDatabase({
      combatants: [monsterRow({ afflictions: ['fobia'] })],
    });
    const combat = combatRepository(fake.database);

    await combat.saveInstanceVitals(
      's-1',
      'mon-1',
      { currentHp: 7, currentEffort: 5 },
      PLAYER_ID,
    );

    expect(fake.combatants()[0]).toMatchObject({
      currentHp: 7,
      currentEffort: 5,
      afflictions: ['fobia'],
    });
  });

  it('saveInstanceVitals leaves combatants outside the predicate untouched', async () => {
    const fake = fakeCombatDatabase({
      combatants: [
        monsterRow(),
        monsterRow({
          id: 'c-2',
          kind: 'character',
          refId: 'char-1',
          name: 'Ana',
          currentHp: 8,
          currentEffort: 2,
        }),
      ],
    });
    const combat = combatRepository(fake.database);

    await combat.saveInstanceVitals(
      's-1',
      'mon-1',
      { currentHp: 7, currentEffort: 3 },
      PLAYER_ID,
    );

    expect(fake.combatants()[0]).toMatchObject({
      currentHp: 7,
      currentEffort: 3,
    });
    expect(fake.combatants()[1]).toEqual({
      id: 'c-2',
      sessionId: 's-1',
      kind: 'character',
      refId: 'char-1',
      name: 'Ana',
      initiativeValue: 12,
      hasRolled: true,
      currentHp: 8,
      maxHp: 10,
      currentEffort: 2,
      maxEffort: 5,
      afflictions: [],
      cognition: 2,
      psyche: -2,
      instinct: 0,
      constitution: 3,
      motricity: 1,
      perception: 0,
      createdAt: new Date(2024, 0, 1),
    });
  });
});
