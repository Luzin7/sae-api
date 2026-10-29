import { readFileSync } from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { integrationEnabled } from '@test/integration-env.js';
import {
  createSeed,
  skillIdByName,
  type SeededTable,
} from '@test/integration-db.js';
import { db } from '@infra/db/index.js';
import {
  character,
  characterSkill,
  combatant,
  sessionLog,
} from '@infra/db/schema.js';
import { InMemoryMessageBus } from '@modules/chat/chat.bus.js';
import { NextTurnService } from '@modules/chat/next-turn/next-turn.service.js';
import { StartCombatService } from '@modules/chat/start-combat/start-combat.service.js';
import type { AfflictionKey } from '@shared/rules/afflictions.js';
import { systemRng } from '@shared/dice/random.js';
import { characterAccessRepository } from './character-access.repository.js';
import { characterRepository } from './character.repository.js';
import { chatMessageRepository } from './chat-message.repository.js';
import { combatRepository } from './combat.repository.js';
import { combatantSourceRepository } from './combatant-source.repository.js';
import { gameAccessRepository } from './game-access.repository.js';

const ROUNDS = 20;

const { cleanupSeed, seedCharacter, seedMonster, seedTable } =
  createSeed('pontos-de-esforco');

describe.skipIf(!integrationEnabled)('pontos de esforco (real DB)', () => {
  const access = characterAccessRepository();
  const characters = characterRepository();
  const combat = combatRepository();
  const bus = new InMemoryMessageBus();
  const startCombat = new StartCombatService(
    chatMessageRepository(),
    gameAccessRepository(),
    combatantSourceRepository(),
    combat,
    bus,
    systemRng,
  );
  const nextTurn = new NextTurnService(
    chatMessageRepository(),
    gameAccessRepository(),
    combat,
    bus,
  );
  let table: SeededTable;

  beforeEach(async () => {
    table = await seedTable();
  });

  afterAll(async () => {
    await cleanupSeed();
  });

  async function readCharacter(id: string) {
    const [row] = await db.select().from(character).where(eq(character.id, id));
    if (!row) throw new Error('character missing');

    return row;
  }

  async function readInstance(sessionId: string, refId: string) {
    const [row] = await db
      .select()
      .from(combatant)
      .where(
        and(eq(combatant.sessionId, sessionId), eq(combatant.refId, refId)),
      );
    if (!row) throw new Error('combatant missing');

    return row;
  }

  async function logTypes(sessionId: string): Promise<string[]> {
    const rows = await db
      .select({ eventType: sessionLog.eventType })
      .from(sessionLog)
      .where(eq(sessionLog.sessionId, sessionId))
      .orderBy(sessionLog.id);

    return rows.map((row) => row.eventType);
  }

  describe('locked effort write', () => {
    it('concurrent pe-change and damageHp on one character lose no update (x20)', async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const row = await seedCharacter(table, {
          currentHp: 26,
          currentEffort: 0,
        });

        await Promise.all([
          access.changeEffort(row.id, 5, {
            sessionId: table.sessionId,
            playerId: table.member.id,
          }),
          access.changeHp(row.id, -3, {
            sessionId: table.sessionId,
            playerId: table.member.id,
          }),
        ]);

        const after = await readCharacter(row.id);
        expect(after.currentEffort).toBe(5);
        expect(after.currentHp).toBe(23);
        expect(after.version).toBe(2);
      }
    });

    it('concurrent gains over the limit charge each excess point to PS once (x20)', async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const row = await seedCharacter(table, {
          currentHp: 26,
          currentEffort: 18,
          maxEffort: 20,
        });

        await Promise.all([
          characters.changeEffort(row.id, 4),
          characters.changeEffort(row.id, 4),
        ]);

        const after = await readCharacter(row.id);
        expect(after.currentEffort).toBe(20);
        expect(after.currentHp).toBe(26 - 6);
        expect(after.version).toBe(2);
      }
    });

    it('writes effort, hp and both log rows together', async () => {
      const row = await seedCharacter(table, {
        currentHp: 30,
        currentEffort: 18,
        maxEffort: 20,
      });

      const result = await access.changeEffort(row.id, 5, {
        sessionId: table.sessionId,
        playerId: table.member.id,
      });

      expect(result).toEqual({
        oldEffort: 18,
        newEffort: 20,
        oldHp: 30,
        newHp: 27,
      });
      expect((await logTypes(table.sessionId)).sort()).toEqual([
        'hp_change',
        'pe_change',
      ]);
    });

    it('recovery floors at zero and leaves PS alone', async () => {
      const row = await seedCharacter(table, {
        currentHp: 30,
        currentEffort: 3,
      });

      const { character: after } = await characters.changeEffort(row.id, -10);

      expect(after.currentEffort).toBe(0);
      expect(after.currentHp).toBe(30);
    });
  });

  describe('locked hp write', () => {
    const log = () => ({
      sessionId: table.sessionId,
      playerId: table.member.id,
    });

    it('concurrent hp-change(+1) and damage x20 land on the clamped sum', async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const row = await seedCharacter(table, { currentHp: 10, maxHp: 26 });

        await Promise.all([
          ...Array.from({ length: 5 }, () => access.changeHp(row.id, 1, log())),
          ...Array.from({ length: 5 }, () =>
            access.changeHp(row.id, -2, log()),
          ),
        ]);

        const after = await readCharacter(row.id);
        expect(after.currentHp).toBe(5);
        expect(after.version).toBe(10);
      }
    });

    it('concurrent heals above the max clamp once and lose nothing', async () => {
      const row = await seedCharacter(table, { currentHp: 20, maxHp: 26 });

      await Promise.all(
        Array.from({ length: 10 }, () => access.changeHp(row.id, 1, log())),
      );

      const after = await readCharacter(row.id);
      expect(after.currentHp).toBe(26);
      expect(after.version).toBe(6);
    });

    it('concurrent hp-change and pe-change on one character lose no update (x20)', async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const row = await seedCharacter(table, {
          currentHp: 20,
          currentEffort: 0,
        });

        await Promise.all([
          access.changeHp(row.id, -4, log()),
          access.changeEffort(row.id, 6, log()),
        ]);

        const after = await readCharacter(row.id);
        expect(after.currentHp).toBe(16);
        expect(after.currentEffort).toBe(6);
      }
    });

    it('floors at zero and writes nothing when already there', async () => {
      const row = await seedCharacter(table, { currentHp: 0 });

      const result = await access.changeHp(row.id, -3, log());

      expect(result).toEqual({ oldHp: 0, newHp: 0 });
      expect((await readCharacter(row.id)).version).toBe(0);
      expect(await logTypes(table.sessionId)).toEqual([]);
    });

    it('logs hp_change with the actual delta', async () => {
      const row = await seedCharacter(table, { currentHp: 24, maxHp: 26 });

      await access.changeHp(row.id, 5, log());

      const [entry] = await db
        .select()
        .from(sessionLog)
        .where(eq(sessionLog.sessionId, table.sessionId));
      expect(entry?.eventType).toBe('hp_change');
      expect(entry?.payload).toEqual({
        characterId: row.id,
        delta: 2,
        currentHp: 26,
        maxHp: 26,
      });
    });

    it('monster instance PS clamps 0..maxHp on the combatant row', async () => {
      const monster = await seedMonster(table.master.id, {
        gameId: table.gameId,
        maxHp: 10,
        currentHp: 10,
      });
      await startCombat.execute({
        playerId: table.master.id,
        sessionId: table.sessionId,
      });

      const down = await combat.changeInstanceHp({
        sessionId: table.sessionId,
        monsterId: monster.id,
        delta: -15,
        playerId: table.master.id,
      });
      const up = await combat.changeInstanceHp({
        sessionId: table.sessionId,
        monsterId: monster.id,
        delta: 4,
        playerId: table.master.id,
      });

      expect([down.oldHp, down.newHp]).toEqual([10, 0]);
      expect([up.oldHp, up.newHp]).toEqual([0, 4]);
      expect((await readInstance(table.sessionId, monster.id)).currentHp).toBe(
        4,
      );
    });

    it('sets the afflictions list on the instance and replaces it on the next call', async () => {
      const monster = await seedMonster(table.master.id, {
        gameId: table.gameId,
      });
      await startCombat.execute({
        playerId: table.master.id,
        sessionId: table.sessionId,
      });
      const set = (afflictions: AfflictionKey[]) =>
        combat.setInstanceAfflictions({
          sessionId: table.sessionId,
          monsterId: monster.id,
          afflictions,
          playerId: table.master.id,
        });

      const first = await set(['fobia', 'vicio']);
      const hpBefore = (await readInstance(table.sessionId, monster.id))
        .currentHp;
      await set(['trauma']);

      const instance = await readInstance(table.sessionId, monster.id);
      expect(
        first.state.entries.find((entry) => entry.refId === monster.id)
          ?.afflictions,
      ).toEqual(['fobia', 'vicio']);
      expect(instance.afflictions).toEqual(['trauma']);
      expect(instance.currentHp).toBe(hpBefore);
      expect(await logTypes(table.sessionId)).toContain('combat_state');
    });

    it('concurrent monster hp-change calls lose no update (x20)', async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const fresh = await seedTable();
        table = fresh;
        const monster = await seedMonster(table.master.id, {
          gameId: table.gameId,
          maxHp: 100,
          currentHp: 40,
        });
        await startCombat.execute({
          playerId: table.master.id,
          sessionId: table.sessionId,
        });
        const hit = (delta: number) =>
          combat.changeInstanceHp({
            sessionId: table.sessionId,
            monsterId: monster.id,
            delta,
            playerId: table.master.id,
          });

        await Promise.all([hit(-5), hit(-7), hit(3), hit(-2)]);

        expect(
          (await readInstance(table.sessionId, monster.id)).currentHp,
        ).toBe(29);
      }
    });
  });

  describe('monster instance', () => {
    it('gains effort on the combatant row with the same rule on its PS', async () => {
      const monster = await seedMonster(table.master.id, {
        gameId: table.gameId,
        maxHp: 10,
        currentHp: 10,
        maxEffort: 5,
      });
      await startCombat.execute({
        playerId: table.master.id,
        sessionId: table.sessionId,
      });

      const change = await combat.changeInstanceEffort({
        sessionId: table.sessionId,
        monsterId: monster.id,
        delta: 7,
        playerId: table.master.id,
      });

      expect(change).toMatchObject({
        oldEffort: 0,
        newEffort: 5,
        oldHp: 10,
        newHp: 8,
      });
      const instance = await readInstance(table.sessionId, monster.id);
      expect(instance.currentEffort).toBe(5);
      expect(instance.currentHp).toBe(8);
    });

    it('combat instances start at 0 PE whatever the template holds', async () => {
      const monster = await seedMonster(table.master.id, {
        gameId: table.gameId,
        maxEffort: 5,
      });
      await startCombat.execute({
        playerId: table.master.id,
        sessionId: table.sessionId,
      });

      const instance = await readInstance(table.sessionId, monster.id);

      expect(instance.currentEffort).toBe(0);
      expect(instance.maxEffort).toBe(5);
    });
  });

  describe('per-turn recovery', () => {
    const ORDER = [20, 15, 10, 5, 1];

    async function seedCombat(efforts: {
      a: number;
      b: number;
      c: number;
      m1: number;
      m2: number;
    }) {
      const [a, b, c] = [
        await seedCharacter(table, { currentEffort: efforts.a }),
        await seedCharacter(table, { currentEffort: efforts.b }),
        await seedCharacter(table, { currentEffort: efforts.c }),
      ];
      const m1 = await seedMonster(table.master.id, {
        gameId: table.gameId,
        maxEffort: 9,
      });
      const m2 = await seedMonster(table.master.id, {
        gameId: table.gameId,
        maxEffort: 9,
      });
      await startCombat.execute({
        playerId: table.master.id,
        sessionId: table.sessionId,
      });
      for (const [index, ref] of [a, b, c, m1, m2].entries()) {
        await db
          .update(combatant)
          .set({ initiativeValue: ORDER[index], hasRolled: true })
          .where(
            and(
              eq(combatant.sessionId, table.sessionId),
              eq(combatant.refId, ref.id),
            ),
          );
      }
      await db
        .update(combatant)
        .set({ currentEffort: efforts.m1 })
        .where(
          and(
            eq(combatant.sessionId, table.sessionId),
            eq(combatant.refId, m1.id),
          ),
        );
      await db
        .update(combatant)
        .set({ currentEffort: efforts.m2 })
        .where(
          and(
            eq(combatant.sessionId, table.sessionId),
            eq(combatant.refId, m2.id),
          ),
        );

      return { a, b, c, m1, m2 };
    }

    const advance = (expectedTurnIndex: number) =>
      nextTurn.execute({
        playerId: table.master.id,
        sessionId: table.sessionId,
        expectedTurnIndex,
        expectedRound: 1,
      });

    async function efforts(ids: {
      a: { id: string };
      b: { id: string };
      c: { id: string };
      m1: { id: string };
      m2: { id: string };
    }) {
      return {
        a: (await readCharacter(ids.a.id)).currentEffort,
        b: (await readCharacter(ids.b.id)).currentEffort,
        c: (await readCharacter(ids.c.id)).currentEffort,
        m1: (await readInstance(table.sessionId, ids.m1.id)).currentEffort,
        m2: (await readInstance(table.sessionId, ids.m2.id)).currentEffort,
      };
    }

    it('turn A to B: everyone with PE loses 1 except B, characters and monsters', async () => {
      const ids = await seedCombat({ a: 3, b: 2, c: 0, m1: 3, m2: 0 });

      await advance(0);

      expect(await efforts(ids)).toEqual({ a: 2, b: 2, c: 0, m1: 2, m2: 0 });
    });

    it('bumps the version only of characters whose PE changed', async () => {
      const ids = await seedCombat({ a: 3, b: 2, c: 0, m1: 0, m2: 0 });

      await advance(0);

      expect((await readCharacter(ids.a.id)).version).toBe(1);
      expect((await readCharacter(ids.b.id)).version).toBe(0);
      expect((await readCharacter(ids.c.id)).version).toBe(0);
    });

    it('over three advances m1 loses 1 on the first two and keeps it when its own turn starts', async () => {
      const ids = await seedCombat({ a: 3, b: 2, c: 1, m1: 4, m2: 2 });

      await advance(0);
      await advance(1);
      await advance(2);

      expect(await efforts(ids)).toEqual({ a: 0, b: 0, c: 0, m1: 2, m2: 0 });
    });

    it('reports the recovered characters from the repository', async () => {
      const ids = await seedCombat({ a: 3, b: 2, c: 1, m1: 0, m2: 0 });

      const result = await combat.advanceTurn({
        sessionId: table.sessionId,
        playerId: table.master.id,
        expectedTurnIndex: 0,
        expectedRound: 1,
      });

      expect(result.recovered).toHaveLength(2);
      expect(result.recovered).toEqual(
        expect.arrayContaining([
          { characterId: ids.a.id, oldEffort: 3, newEffort: 2 },
          { characterId: ids.c.id, oldEffort: 1, newEffort: 0 },
        ]),
      );
    });

    it('duplicate next-turn frames recover once (x20)', async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const fresh = await seedTable();
        table = fresh;
        const ids = await seedCombat({ a: 3, b: 2, c: 0, m1: 3, m2: 0 });

        await Promise.all([advance(0), advance(0)]);

        expect(await efforts(ids)).toEqual({ a: 2, b: 2, c: 0, m1: 2, m2: 0 });
      }
    });

    it('a stale frame changes nothing', async () => {
      const ids = await seedCombat({ a: 3, b: 2, c: 0, m1: 3, m2: 0 });
      await advance(0);

      await advance(0);

      expect(await efforts(ids)).toEqual({ a: 2, b: 2, c: 0, m1: 2, m2: 0 });
    });
  });

  describe('skill limits', () => {
    it('Condicionamento +7 raises maxEffort to 27 and clamps nothing', async () => {
      const row = await seedCharacter(table, { currentEffort: 4 });
      const skillId = await skillIdByName('Condicionamento');

      await characters.upsertSkill({
        characterId: row.id,
        skillId,
        proficiencyBonus: 7,
        deriveLimits: () => ({ maxHp: row.maxHp, maxEffort: 27 }),
      });

      const after = await readCharacter(row.id);
      expect(after.maxEffort).toBe(27);
      expect(after.currentEffort).toBe(4);
      expect(after.version).toBe(1);
    });

    it('lowering the limit clamps current PE and PS in SQL without PS loss', async () => {
      const row = await seedCharacter(table, {
        currentEffort: 25,
        maxEffort: 27,
        currentHp: 26,
      });
      const skillId = await skillIdByName('Condicionamento');

      await characters.upsertSkill({
        characterId: row.id,
        skillId,
        proficiencyBonus: 2,
        deriveLimits: () => ({ maxHp: 20, maxEffort: 22 }),
      });

      const after = await readCharacter(row.id);
      expect(after.maxEffort).toBe(22);
      expect(after.currentEffort).toBe(22);
      expect(after.currentHp).toBe(20);
    });

    it('a skill that does not move the limits leaves the row untouched', async () => {
      const row = await seedCharacter(table);
      const skillId = await skillIdByName('Condicionamento');

      await characters.upsertSkill({
        characterId: row.id,
        skillId,
        proficiencyBonus: 1,
        deriveLimits: () => null,
      });

      const after = await readCharacter(row.id);
      expect(after.version).toBe(0);
      const [skillRow] = await db
        .select()
        .from(characterSkill)
        .where(eq(characterSkill.characterId, row.id));
      expect(skillRow?.proficiencyBonus).toBe(1);
    });
  });

  describe('migration 0009', () => {
    const statements = readFileSync(
      new URL('../migrations/0009_pontos_de_esforco.sql', import.meta.url),
      'utf8',
    ).split('--> statement-breakpoint');

    async function runMigration(): Promise<void> {
      await db.transaction(async (tx) => {
        for (const statement of statements)
          await tx.execute(sql.raw(statement));
      });
    }

    it('reruns without touching effort already stored', async () => {
      const row = await seedCharacter(table, { currentEffort: 4 });

      await runMigration();
      await runMigration();

      expect((await readCharacter(row.id)).currentEffort).toBe(4);
    });

    it('the check rejects effort above the limit and below zero', async () => {
      const row = await seedCharacter(table, { maxEffort: 20 });

      await expect(
        db
          .update(character)
          .set({ currentEffort: 21 })
          .where(eq(character.id, row.id)),
      ).rejects.toThrow();
      await expect(
        db
          .update(character)
          .set({ currentEffort: -1 })
          .where(eq(character.id, row.id)),
      ).rejects.toThrow();
    });
  });
});
