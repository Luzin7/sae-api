import { describe, expect, it } from 'vitest';
import type { CombatantSeed } from './combat.repository.js';
import { CombatNotReadyError } from './chat.errors.js';
import { makeChatMessages, makeInMemoryCombat } from './chat.testkit.js';

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

async function rolledCombat() {
  const combat = makeInMemoryCombat();
  await combat.start('s-1', SEEDS, PLAYER_ID);
  await combat.rollInitiative('s-1', 'character', 'char-1', () => 9, PLAYER_ID);
  await combat.rollInitiative('s-1', 'monster', 'mon-1', () => 15, PLAYER_ID);

  return combat;
}

describe('CombatRepository contract (in-memory fake)', () => {
  it('re-rolling an already rolled combatant is idempotent', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, PLAYER_ID);

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

    expect(first.entries[0]?.initiativeValue).toBe(9);
    expect(second.entries[0]?.initiativeValue).toBe(9);
  });

  it('start replaces the roster without leaving duplicates', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, PLAYER_ID);

    const state = await combat.start('s-1', SEEDS, PLAYER_ID);

    expect(state.entries).toHaveLength(2);
    expect(state.entries.every((entry) => !entry.hasRolled)).toBe(true);
  });

  it('end removes the combatants so no orphans remain', async () => {
    const combat = makeInMemoryCombat();
    await combat.start('s-1', SEEDS, PLAYER_ID);

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
    await combat.start('s-1', SEEDS, PLAYER_ID);

    await expect(advance(combat, 0)).rejects.toBeInstanceOf(
      CombatNotReadyError,
    );
  });

  it('writes the combat_state log only when the turn actually moves', async () => {
    const messages = makeChatMessages();
    const combat = makeInMemoryCombat(messages);
    await combat.start('s-1', SEEDS, PLAYER_ID);
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
