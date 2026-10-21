import { describe, expect, it } from 'vitest';
import type { CombatantPayload } from '@modules/session/session.entity.js';
import { orderEntries, pickUniqueValue } from './combat.repository.js';

type Row = {
  id: string;
  kind: 'character' | 'monster';
  refId: string;
  name: string;
  initiativeValue: number | null;
  hasRolled: boolean;
  createdAt: Date;
};

function row(overrides: Partial<Row> & { id: string }): Row {
  return {
    kind: 'character',
    refId: `ref-${overrides.id}`,
    name: overrides.id,
    initiativeValue: null,
    hasRolled: false,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function sequenced(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;

    return value ?? 1;
  };
}

describe('pickUniqueValue', () => {
  it('skips values already taken', () => {
    expect(pickUniqueValue([3], sequenced([3, 5]))).toBe(5);
  });

  it('falls back to the first free face when attempts are exhausted', () => {
    const roll = sequenced([3]);
    const value = pickUniqueValue([3], roll);

    expect(value).toBe(1);
    expect(value).not.toBe(3);
  });

  it('never loops forever with a full board and a repeating roll', () => {
    const taken = Array.from({ length: 20 }, (_, index) => index + 1);
    let calls = 0;
    const roll = () => {
      calls += 1;

      return 3;
    };

    expect(pickUniqueValue(taken, roll)).toBe(3);
    expect(calls).toBe(21);
  });
});

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
