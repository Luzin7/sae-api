import { describe, expect, it } from 'vitest';
import type { CombatantSeed } from './combat.repository.js';
import { CombatNotReadyError } from './chat.errors.js';
import {
  makeChatMessages,
  makeInMemoryCombat,
  sequenceRng,
} from './chat.testkit.js';

const SEEDS: CombatantSeed[] = [
  { kind: 'character', refId: 'char-1', name: 'Ana' },
  { kind: 'monster', refId: 'mon-1', name: 'Goblin' },
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
      [...SEEDS, { kind: 'monster', refId: 'mon-2', name: 'Orc' }],
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
