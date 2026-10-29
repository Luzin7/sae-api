import { describe, expect, it } from 'vitest';
import type { GameRef } from '@shared/game-access/game-access.contract.js';
import type { Monster } from './bestiary.entity.js';
import { canManageMonster } from './bestiary.authorization.js';

const OWNER_ID = 'owner-1';
const OTHER_ID = 'other-1';
const GAME_ID = 'game-1';

function makeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: 'monster-1',
    gameId: GAME_ID,
    name: 'Goblin',
    np: 1,
    maxHp: 10,
    currentHp: 10,
    maxEffort: 5,
    size: null,
    cognition: -5,
    psyche: -5,
    instinct: -5,
    constitution: -5,
    motricity: -5,
    perception: -5,
    heightCm: null,
    weightKg: null,
    notes: null,
    createdBy: OWNER_ID,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeGame(overrides: Partial<GameRef> = {}): GameRef {
  return { id: GAME_ID, masterId: OWNER_ID, ...overrides };
}

describe('canManageMonster', () => {
  it('allows the owner of a reusable entry', () => {
    expect(
      canManageMonster(makeMonster({ gameId: null }), null, OWNER_ID),
    ).toBe(true);
  });

  it('forbids another master from a reusable entry', () => {
    expect(
      canManageMonster(
        makeMonster({ gameId: null }),
        makeGame({ masterId: OTHER_ID }),
        OTHER_ID,
      ),
    ).toBe(false);
  });

  it('allows the master of the table', () => {
    expect(canManageMonster(makeMonster(), makeGame(), OWNER_ID)).toBe(true);
  });

  it('forbids a non-master from a table entry', () => {
    expect(canManageMonster(makeMonster(), makeGame(), OTHER_ID)).toBe(false);
  });

  it('forbids everyone when the table of a scoped entry is missing', () => {
    expect(canManageMonster(makeMonster(), null, OWNER_ID)).toBe(false);
  });
});
