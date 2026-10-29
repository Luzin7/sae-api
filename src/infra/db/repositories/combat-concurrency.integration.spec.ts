import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { integrationEnabled } from '@test/integration-env.js';
import { createSeed, type SeededTable } from '@test/integration-db.js';
import { db } from '@infra/db/index.js';
import { combatant, combatState, sessionLog } from '@infra/db/schema.js';
import { InMemoryMessageBus } from '@modules/chat/chat.bus.js';
import { AddMonsterService } from '@modules/chat/add-monster/add-monster.service.js';
import { NextTurnService } from '@modules/chat/next-turn/next-turn.service.js';
import { StartCombatService } from '@modules/chat/start-combat/start-combat.service.js';
import { DeleteCharacterService } from '@modules/character/delete-character/delete-character.service.js';
import { systemRng } from '@shared/dice/random.js';
import { characterRepository } from './character.repository.js';
import { chatMessageRepository } from './chat-message.repository.js';
import { combatRepository } from './combat.repository.js';
import { combatantSourceRepository } from './combatant-source.repository.js';
import { gameAccessRepository } from './game-access.repository.js';

const notifier = {
  notifyRosterChanged: async () => undefined,
  notifyHpChanged: async () => undefined,
  notifyCombatChanged: async () => undefined,
};

const {
  cleanupSeed,
  seedCharacter,
  seedInactiveSession,
  seedMonster,
  seedTable,
} = createSeed('combat-concurrency');

describe.skipIf(!integrationEnabled)('combat concurrency (real DB)', () => {
  const messages = chatMessageRepository();
  const gameAccess = gameAccessRepository();
  const combatants = combatantSourceRepository();
  const combat = combatRepository();
  const bus = new InMemoryMessageBus();
  const startCombat = new StartCombatService(
    messages,
    gameAccess,
    combatants,
    combat,
    bus,
    systemRng,
  );
  const addMonster = new AddMonsterService(
    messages,
    gameAccess,
    combatants,
    combat,
    bus,
  );
  const nextTurn = new NextTurnService(messages, gameAccess, combat, bus);
  const deleteCharacter = new DeleteCharacterService(
    characterRepository(),
    gameAccess,
    notifier,
  );
  let table: SeededTable;

  beforeEach(async () => {
    table = await seedTable();
  });

  afterAll(async () => {
    await cleanupSeed();
  });

  async function freshSession(): Promise<string> {
    return table.sessionId;
  }

  async function combatantRows(sessionId: string) {
    return db
      .select()
      .from(combatant)
      .where(eq(combatant.sessionId, sessionId));
  }

  async function stateRow(sessionId: string) {
    const [row] = await db
      .select()
      .from(combatState)
      .where(eq(combatState.sessionId, sessionId));

    return row;
  }

  async function logCount(sessionId: string): Promise<number> {
    const rows = await db
      .select({ id: sessionLog.id })
      .from(sessionLog)
      .where(eq(sessionLog.sessionId, sessionId));

    return rows.length;
  }

  async function startWithRolledCharacters(sessionId: string, count: number) {
    const characters = [];
    for (let index = 0; index < count; index++) {
      characters.push(await seedCharacter(table));
    }
    await startCombat.execute({ playerId: table.master.id, sessionId });
    for (const [index, row] of characters.entries()) {
      await combat.rollInitiative(
        sessionId,
        'character',
        row.id,
        () => 20 - index,
        table.master.id,
      );
    }

    return characters;
  }

  it('6. restart keeps a reusable monster added mid-combat', async () => {
    const sessionId = await freshSession();
    const reusable = await seedMonster(table.master.id, {
      gameId: null,
      maxHp: 33,
      currentHp: 33,
    });
    await startCombat.execute({ playerId: table.master.id, sessionId });
    await addMonster.execute({
      playerId: table.master.id,
      sessionId,
      monsterId: reusable.id,
    });
    const before = (await combatantRows(sessionId)).find(
      (row) => row.refId === reusable.id,
    );
    const stateBefore = await stateRow(sessionId);

    await startCombat.execute({ playerId: table.master.id, sessionId });

    const after = (await combatantRows(sessionId)).find(
      (row) => row.refId === reusable.id,
    );
    const stateAfter = await stateRow(sessionId);
    expect(after).toBeDefined();
    expect(after?.maxHp).toBe(33);
    expect(after?.currentHp).toBe(33);
    expect(after?.hasRolled).toBe(true);
    expect(after?.initiativeValue).toBe(before?.initiativeValue);
    expect(stateAfter?.turnIndex).toBe(stateBefore?.turnIndex);
    expect(stateAfter?.round).toBe(stateBefore?.round);
  });

  describe('7. advanceTurn with the same expected turn', () => {
    const advance = (sessionId: string) =>
      nextTurn.execute({
        playerId: table.master.id,
        sessionId,
        expectedTurnIndex: 0,
        expectedRound: 1,
      });

    it('sequential calls advance exactly once', async () => {
      const sessionId = await freshSession();
      await startWithRolledCharacters(sessionId, 3);
      const logsBefore = await logCount(sessionId);

      await advance(sessionId);
      await advance(sessionId);

      const state = await stateRow(sessionId);
      expect(state?.turnIndex).toBe(1);
      expect(state?.round).toBe(1);
      expect(await logCount(sessionId)).toBe(logsBefore + 1);
    });

    it('concurrent calls advance exactly once', async () => {
      const sessionId = await freshSession();
      await startWithRolledCharacters(sessionId, 3);
      const logsBefore = await logCount(sessionId);

      await Promise.all(Array.from({ length: 5 }, () => advance(sessionId)));

      const state = await stateRow(sessionId);
      expect(state?.turnIndex).toBe(1);
      expect(state?.round).toBe(1);
      expect(await logCount(sessionId)).toBe(logsBefore + 1);
    });
  });

  it('8. concurrent start-combat on a fresh session creates no duplicates', async () => {
    const problems: string[] = [];
    const gameTable = await seedTable();
    for (let index = 0; index < 3; index++) await seedCharacter(gameTable);
    for (let index = 0; index < 5; index++) {
      await seedMonster(gameTable.master.id, { gameId: gameTable.gameId });
    }

    for (let round = 0; round < 15; round++) {
      const sessionId = await seedInactiveSession(gameTable.gameId);
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          startCombat.execute({ playerId: gameTable.master.id, sessionId }),
        ),
      );

      const rows = await combatantRows(sessionId);
      const keys = new Set(rows.map((row) => `${row.kind}:${row.refId}`));
      const monsterRolls = rows
        .filter((row) => row.kind === 'monster')
        .map((row) => row.initiativeValue);
      if (rows.length !== 8)
        problems.push(`round ${round}: ${rows.length} rows`);
      if (keys.size !== rows.length)
        problems.push(`round ${round}: duplicate keys`);
      if (new Set(monsterRolls).size !== monsterRolls.length)
        problems.push(`round ${round}: repeated initiative ${monsterRolls}`);
      if (monsterRolls.some((value) => value === null))
        problems.push(`round ${round}: monster not rolled`);
      const rollsSeen = results.map((state) =>
        state.entries
          .filter((entry) => entry.kind === 'monster')
          .map((entry) => `${entry.refId}=${entry.initiativeValue}`)
          .sort()
          .join(),
      );
      const settled = rollsSeen.filter((seen) => seen === rollsSeen.at(-1));
      if (new Set(rollsSeen.filter((seen) => seen.length > 0)).size > 1)
        problems.push(
          `round ${round}: monster rolled twice ${settled.length}/${rollsSeen.length}`,
        );
    }

    expect(problems).toEqual([]);
  });

  describe('9. delete a character in an active combat', () => {
    async function deleteAndRead(
      sessionId: string,
      deleteIndex: number,
      advanceTo: number,
    ) {
      const characters = await startWithRolledCharacters(sessionId, 3);
      for (let step = 0; step < advanceTo; step++) {
        const state = await stateRow(sessionId);
        await nextTurn.execute({
          playerId: table.master.id,
          sessionId,
          expectedTurnIndex: state?.turnIndex ?? 0,
          expectedRound: state?.round ?? 1,
        });
      }
      const target = characters[deleteIndex];
      if (!target) throw new Error('missing character');
      await deleteCharacter.execute(target.id, table.master.id);

      return {
        target,
        state: await stateRow(sessionId),
        rows: await combatantRows(sessionId),
      };
    }

    it('deleting the current turn keeps the index on the next combatant', async () => {
      const sessionId = await freshSession();
      const { target, state, rows } = await deleteAndRead(sessionId, 1, 1);

      expect(rows.map((row) => row.refId)).not.toContain(target.id);
      expect(rows).toHaveLength(2);
      expect(state?.turnIndex).toBe(1);
      expect(state?.round).toBe(1);
    });

    it('deleting the current last turn wraps to the first and bumps the round', async () => {
      const sessionId = await freshSession();
      const { target, state, rows } = await deleteAndRead(sessionId, 2, 2);

      expect(rows.map((row) => row.refId)).not.toContain(target.id);
      expect(state?.turnIndex).toBe(0);
      expect(state?.round).toBe(2);
    });

    it('deleting a combatant before the current turn shifts the index back', async () => {
      const sessionId = await freshSession();
      const { target, state, rows } = await deleteAndRead(sessionId, 0, 2);

      expect(rows.map((row) => row.refId)).not.toContain(target.id);
      expect(state?.turnIndex).toBe(1);
      expect(state?.round).toBe(1);
    });

    it('deleting a combatant after the current turn leaves the position', async () => {
      const sessionId = await freshSession();
      const { target, state, rows } = await deleteAndRead(sessionId, 2, 0);

      expect(rows.map((row) => row.refId)).not.toContain(target.id);
      expect(state?.turnIndex).toBe(0);
      expect(state?.round).toBe(1);
    });

    it('next-turn is not blocked after a delete', async () => {
      const sessionId = await freshSession();
      const { state } = await deleteAndRead(sessionId, 1, 1);

      const next = await nextTurn.execute({
        playerId: table.master.id,
        sessionId,
        expectedTurnIndex: state?.turnIndex ?? 0,
        expectedRound: state?.round ?? 1,
      });

      expect(next.turnIndex).toBe(0);
      expect(next.round).toBe(2);
    });
  });
});
