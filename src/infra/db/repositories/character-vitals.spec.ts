import { describe, expect, it } from 'vitest';
import { planEffortChange, planHpChange } from './character-vitals.js';

const LOG = { sessionId: 'session-1', playerId: 'player-1' };

function locked(currentEffort: number, currentHp: number) {
  return {
    id: 'char-1',
    currentEffort,
    maxEffort: 20,
    currentHp,
    maxHp: 40,
  };
}

describe('planEffortChange', () => {
  it('18/20 PE with 30 PS +5 caps effort and costs 3 PS, logging both', () => {
    const plan = planEffortChange(locked(18, 30), 5, LOG);

    expect(plan.next).toEqual({ currentEffort: 20, currentHp: 27 });
    expect(plan.logs).toEqual([
      {
        ...LOG,
        eventType: 'pe_change',
        payload: {
          characterId: 'char-1',
          delta: 2,
          currentEffort: 20,
          maxEffort: 20,
        },
      },
      {
        ...LOG,
        eventType: 'hp_change',
        payload: { characterId: 'char-1', delta: -3, currentHp: 27, maxHp: 40 },
      },
    ]);
  });

  it('recovery logs only pe_change and leaves PS alone', () => {
    const plan = planEffortChange(locked(5, 30), -3, LOG);

    expect(plan.next).toEqual({ currentEffort: 2, currentHp: 30 });
    expect(plan.logs.map((log) => log.eventType)).toEqual(['pe_change']);
  });

  it('writes nothing when neither effort nor PS moves', () => {
    const plan = planEffortChange(locked(0, 30), -4, LOG);

    expect(plan.changed).toBe(false);
    expect(plan.logs).toEqual([]);
  });

  it('builds no log rows without a session', () => {
    const plan = planEffortChange(locked(18, 30), 5, null);

    expect(plan.next).toEqual({ currentEffort: 20, currentHp: 27 });
    expect(plan.logs).toEqual([]);
  });
});

describe('planHpChange', () => {
  it('+5 from 10/40 writes 15 and logs the actual delta', () => {
    const plan = planHpChange(locked(3, 10), 5, LOG);

    expect(plan.next).toEqual({ currentEffort: 3, currentHp: 15 });
    expect(plan.logs).toEqual([
      {
        ...LOG,
        eventType: 'hp_change',
        payload: { characterId: 'char-1', delta: 5, currentHp: 15, maxHp: 40 },
      },
    ]);
  });

  it('clamps at max and logs the clamped delta', () => {
    const plan = planHpChange(locked(0, 38), 5, LOG);

    expect(plan.next.currentHp).toBe(40);
    expect(plan.logs[0]).toMatchObject({ payload: { delta: 2 } });
  });

  it('writes nothing when already at the floor', () => {
    const plan = planHpChange(locked(0, 0), -1, LOG);

    expect(plan.changed).toBe(false);
    expect(plan.logs).toEqual([]);
  });

  it('never touches effort', () => {
    expect(planHpChange(locked(7, 30), -4, null).next.currentEffort).toBe(7);
  });
});
