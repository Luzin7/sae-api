import { describe, expect, it } from 'vitest';
import type { CombatantSeed } from './combat.repository.js';
import { makeInMemoryCombat } from './chat.testkit.js';

const SEEDS: CombatantSeed[] = [
  { kind: 'character', refId: 'char-1', name: 'Ana' },
  { kind: 'monster', refId: 'mon-1', name: 'Goblin' },
];

describe('CombatRepository contract (in-memory fake)', () => {
  it('re-rolling an already rolled combatant is idempotent', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS);

    const first = await combat.rollInitiative('s-1', 'character', 'char-1', () =>
      9,
    );
    const second = await combat.rollInitiative(
      's-1',
      'character',
      'char-1',
      () => 20,
    );

    expect(first.entries[0]?.initiativeValue).toBe(9);
    expect(second.entries[0]?.initiativeValue).toBe(9);
  });

  it('start replaces the roster without leaving duplicates', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS);
    await combat.rollInitiative('s-1', 'character', 'char-1', () => 9);

    const state = await combat.start('s-1', SEEDS);

    expect(state.entries).toHaveLength(2);
    expect(state.entries.every((entry) => !entry.hasRolled)).toBe(true);
  });

  it('end removes the combatants so no orphans remain', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS);

    await combat.end('s-1');

    await expect(combat.findState('s-1')).resolves.toBeNull();
    expect(combat.rows()).toHaveLength(0);
  });
});
