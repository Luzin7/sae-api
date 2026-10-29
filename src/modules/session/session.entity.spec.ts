import { describe, expect, it } from 'vitest';
import { parseSessionEventPayload } from './session.entity.js';

const LEGACY_ROW = {
  active: true,
  turnIndex: 0,
  round: 1,
  entries: [
    {
      combatantId: 'c-1',
      kind: 'monster',
      refId: 'mon-1',
      name: 'Goblin',
      initiativeValue: 7,
      hasRolled: true,
    },
  ],
};

const FRESH_ROW = {
  active: true,
  turnIndex: 0,
  round: 1,
  entries: [
    {
      combatantId: 'c-1',
      kind: 'monster',
      refId: 'mon-1',
      name: 'Goblin',
      initiativeValue: 7,
      hasRolled: true,
      currentHp: 15,
      maxHp: 20,
      currentEffort: 8,
      maxEffort: 10,
      afflictions: ['fobia'],
      cognition: 2,
      psyche: -2,
      instinct: 0,
      constitution: 3,
      motricity: 1,
      perception: 0,
    },
  ],
};

describe('combat_state parse of stored rows', () => {
  it('parses a row written before the instance snapshot fields existed', () => {
    const parsed = parseSessionEventPayload('combat_state', LEGACY_ROW);

    expect(parsed).toEqual({
      active: true,
      turnIndex: 0,
      round: 1,
      entries: [
        {
          combatantId: 'c-1',
          kind: 'monster',
          refId: 'mon-1',
          name: 'Goblin',
          initiativeValue: 7,
          hasRolled: true,
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
    });
  });

  it('round-trips a row written with real instance values', () => {
    expect(parseSessionEventPayload('combat_state', FRESH_ROW)).toEqual(
      FRESH_ROW,
    );
  });
});
