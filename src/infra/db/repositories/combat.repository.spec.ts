import { describe, expect, it } from 'vitest';
import type { CombatantPayload } from '@modules/session/session.entity.js';
import type { CombatantSeed } from '@modules/chat/combat.repository.js';
import { combatant } from '../schema.js';
import {
  assignMonsterRolls,
  orderEntries,
  planCombatants,
} from './combat.repository.js';

type Row = typeof combatant.$inferSelect;

function row(overrides: Partial<Row> & { id: string }): Row {
  return {
    sessionId: 's-1',
    kind: 'character',
    refId: `ref-${overrides.id}`,
    name: overrides.id,
    initiativeValue: null,
    hasRolled: false,
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
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function seed(
  overrides: Partial<CombatantSeed> &
    Pick<CombatantSeed, 'kind' | 'refId' | 'name'>,
): CombatantSeed {
  return {
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
    ...overrides,
  };
}

const ANA: CombatantSeed = seed({
  kind: 'character',
  refId: 'char-1',
  name: 'Ana',
});
const GOBLIN: CombatantSeed = seed({
  kind: 'monster',
  refId: 'mon-1',
  name: 'Goblin',
});
const ORC: CombatantSeed = seed({
  kind: 'monster',
  refId: 'mon-2',
  name: 'Orc',
});

function sequenced(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;

    return value ?? 1;
  };
}

describe('orderEntries', () => {
  it('puts rolled combatants first by value desc, then pending by createdAt', () => {
    const rows = [
      row({
        id: 'pending-late',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
      }),
      row({
        id: 'rolled-low',
        hasRolled: true,
        initiativeValue: 5,
        createdAt: new Date('2024-01-03T00:00:00.000Z'),
      }),
      row({
        id: 'pending-early',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      }),
      row({
        id: 'rolled-high',
        hasRolled: true,
        initiativeValue: 18,
        createdAt: new Date('2024-01-04T00:00:00.000Z'),
      }),
    ];

    const entries: CombatantPayload[] = orderEntries(rows as never);

    expect(entries.map((entry) => entry.refId)).toEqual([
      'ref-rolled-high',
      'ref-rolled-low',
      'ref-pending-early',
      'ref-pending-late',
    ]);
  });

  it('breaks value ties deterministically by createdAt asc', () => {
    const rows = [
      row({
        id: 'tie-late',
        hasRolled: true,
        initiativeValue: 10,
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
      }),
      row({
        id: 'tie-early',
        hasRolled: true,
        initiativeValue: 10,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      }),
    ];

    const entries: CombatantPayload[] = orderEntries(rows as never);

    expect(entries.map((entry) => entry.refId)).toEqual([
      'ref-tie-early',
      'ref-tie-late',
    ]);
  });
});

describe('planCombatants', () => {
  it('inserts every seed when there are no rows yet', () => {
    const plan = planCombatants([], [ANA, GOBLIN]);

    expect(plan).toEqual({ remove: [], insert: [ANA, GOBLIN], rename: [] });
  });

  it('leaves a matching row untouched', () => {
    const plan = planCombatants(
      [row({ id: 'r-1', refId: 'char-1', name: 'Ana' })],
      [ANA],
    );

    expect(plan).toEqual({ remove: [], insert: [], rename: [] });
  });

  it('removes a row missing from the seeds', () => {
    const plan = planCombatants(
      [row({ id: 'r-1', refId: 'char-1', name: 'Ana' })],
      [GOBLIN],
    );

    expect(plan.remove).toEqual(['r-1']);
  });

  it('inserts a seed with no matching row', () => {
    const plan = planCombatants(
      [row({ id: 'r-1', refId: 'char-1', name: 'Ana' })],
      [ANA, GOBLIN],
    );

    expect(plan.insert).toEqual([GOBLIN]);
  });

  it('reports a rename for a kept row whose name changed', () => {
    const plan = planCombatants(
      [row({ id: 'r-1', refId: 'char-1', name: 'Ana' })],
      [seed({ kind: 'character', refId: 'char-1', name: 'Ana Maria' })],
    );

    expect(plan.rename).toEqual([{ id: 'r-1', name: 'Ana Maria' }]);
  });

  it('matches rows on kind and refId together', () => {
    const plan = planCombatants(
      [row({ id: 'r-1', kind: 'monster', refId: 'char-1', name: 'Ana' })],
      [ANA],
    );

    expect(plan.remove).toEqual(['r-1']);
    expect(plan.insert).toEqual([ANA]);
  });
});

describe('assignMonsterRolls', () => {
  it('returns nothing when every monster already rolled', () => {
    const rows = [
      row({
        id: 'r-1',
        kind: 'monster',
        refId: 'mon-1',
        name: 'Goblin',
        hasRolled: true,
        initiativeValue: 9,
      }),
    ];

    const assigned = assignMonsterRolls(rows, [GOBLIN], sequenced([3]));

    expect(assigned).toEqual([]);
  });

  it('ignores characters', () => {
    const rows = [row({ id: 'r-1', refId: 'char-1', name: 'Ana' })];

    const assigned = assignMonsterRolls(rows, [ANA], sequenced([3]));

    expect(assigned).toEqual([]);
  });

  it('skips a rolled monster and keeps its value as taken', () => {
    const rows = [
      row({
        id: 'r-1',
        kind: 'monster',
        refId: 'mon-1',
        name: 'Goblin',
        hasRolled: true,
        initiativeValue: 5,
      }),
      row({ id: 'r-2', kind: 'monster', refId: 'mon-2', name: 'Orc' }),
    ];

    const assigned = assignMonsterRolls(rows, [GOBLIN, ORC], sequenced([5, 8]));

    expect(assigned).toEqual([{ id: 'r-2', value: 8 }]);
  });

  it('treats a rolled player value as taken', () => {
    const rows = [
      row({
        id: 'r-1',
        refId: 'char-1',
        name: 'Ana',
        hasRolled: true,
        initiativeValue: 9,
      }),
      row({ id: 'r-2', kind: 'monster', refId: 'mon-1', name: 'Goblin' }),
    ];

    const assigned = assignMonsterRolls(rows, [ANA, GOBLIN], sequenced([9, 4]));

    expect(assigned).toEqual([{ id: 'r-2', value: 4 }]);
  });

  it('assigns in seed order', () => {
    const rows = [
      row({ id: 'r-a', kind: 'monster', refId: 'mon-1', name: 'Goblin' }),
      row({ id: 'r-b', kind: 'monster', refId: 'mon-2', name: 'Orc' }),
    ];

    const assigned = assignMonsterRolls(rows, [ORC, GOBLIN], sequenced([3, 4]));

    expect(assigned).toEqual([
      { id: 'r-b', value: 3 },
      { id: 'r-a', value: 4 },
    ]);
  });

  it('returns the raw roll when every face is taken', () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, index) =>
        row({
          id: `r-${index}`,
          refId: `char-${index}`,
          name: `char-${index}`,
          hasRolled: true,
          initiativeValue: index + 1,
        }),
      ),
      row({ id: 'r-m', kind: 'monster', refId: 'mon-1', name: 'Goblin' }),
    ];
    let calls = 0;
    const roll = () => {
      calls += 1;

      return 3;
    };

    const assigned = assignMonsterRolls(rows, [GOBLIN], roll);

    expect(assigned).toEqual([{ id: 'r-m', value: 3 }]);
    expect(calls).toBe(1);
  });
});
