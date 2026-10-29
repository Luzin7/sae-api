import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationEnabled } from '@test/integration-env.js';
import {
  createSeed,
  skillIdByName,
  type SeededTable,
} from '@test/integration-db.js';
import { db } from '@infra/db/index.js';
import { character, characterSkill, monster } from '@infra/db/schema.js';
import { CharacterVersionConflictError } from '@modules/character/character.errors.js';
import { CreateCharacterService } from '@modules/character/create-character/create-character.service.js';
import { UpdateCharacterService } from '@modules/character/update-character/update-character.service.js';
import { CreateMonsterService } from '@modules/bestiary/create-monster/create-monster.service.js';
import { systemRng } from '@shared/dice/random.js';
import { randomUUID } from 'node:crypto';
import { characterAccessRepository } from './character-access.repository.js';
import { characterRepository } from './character.repository.js';
import { gameAccessRepository } from './game-access.repository.js';
import { monsterRepository } from './monster.repository.js';

const notifier = {
  notifyRosterChanged: async () => undefined,
  notifyHpChanged: async () => undefined,
  notifyEffortChanged: async () => undefined,
  notifyCombatChanged: async () => undefined,
};
const ROUNDS = 40;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const { cleanupSeed, seedCharacter, seedTable } = createSeed(
  'character-write-integrity',
);

describe.skipIf(!integrationEnabled)(
  'character write integrity (real DB)',
  () => {
    const characters = characterRepository();
    const access = characterAccessRepository();
    const gameAccess = gameAccessRepository();
    const updateCharacter = new UpdateCharacterService(
      characters,
      gameAccess,
      systemRng,
      notifier,
    );
    const createCharacter = new CreateCharacterService(
      characters,
      gameAccess,
      systemRng,
      notifier,
    );
    const createMonster = new CreateMonsterService(
      monsterRepository(),
      gameAccess,
    );
    let table: SeededTable;

    beforeAll(async () => {
      table = await seedTable();
    });

    afterAll(async () => {
      await cleanupSeed();
    });

    async function readCharacter(id: string) {
      const [row] = await db
        .select()
        .from(character)
        .where(eq(character.id, id));
      if (!row) throw new Error('character missing');

      return row;
    }

    function sheetPatch(id: string, version: number, patch: object) {
      return updateCharacter.execute(id, table.master.id, {
        version,
        ...patch,
      });
    }

    it('1. concurrent updateSheet with the same version: exactly one wins', async () => {
      for (let round = 0; round < 20; round++) {
        const row = await seedCharacter(table);
        const results = await Promise.allSettled([
          sheetPatch(row.id, 0, { nickname: 'verify-A' }),
          sheetPatch(row.id, 0, { nickname: 'verify-B' }),
        ]);

        const winners = results.filter((r) => r.status === 'fulfilled');
        const losers = results.filter((r) => r.status === 'rejected');
        expect(winners).toHaveLength(1);
        expect(losers).toHaveLength(1);
        expect(losers[0]?.reason).toBeInstanceOf(CharacterVersionConflictError);
        const winnerNickname = winners[0]?.value.nickname;
        const final = await readCharacter(row.id);
        expect(final.version).toBe(1);
        expect(final.nickname).toBe(winnerNickname);
      }
    });

    it('2. PATCH with a pre-damage version after a PS change is a conflict and keeps the damage', async () => {
      const row = await seedCharacter(table);
      await access.changeHp(row.id, -5, {
        sessionId: table.sessionId,
        playerId: table.member.id,
      });

      await expect(
        sheetPatch(row.id, 0, { nickname: 'verify-late' }),
      ).rejects.toBeInstanceOf(CharacterVersionConflictError);

      const final = await readCharacter(row.id);
      expect(final.currentHp).toBe(21);
      expect(final.version).toBe(1);
      expect(final.nickname).not.toBe('verify-late');
    });

    it('3. PATCH lowering max HP clamps currentHp in SQL', async () => {
      const row = await seedCharacter(table, {
        constitution: 3,
        maxHp: 32,
        currentHp: 32,
      });

      await sheetPatch(row.id, 0, { constitution: -5 });

      const final = await readCharacter(row.id);
      expect(final.maxHp).toBe(26);
      expect(final.currentHp).toBe(26);
    });

    it('3. concurrent damage and max-HP-lowering PATCH never lose an update', async () => {
      const lost: string[] = [];
      for (let round = 0; round < ROUNDS; round++) {
        const row = await seedCharacter(table, {
          constitution: 3,
          maxHp: 32,
          currentHp: 32,
        });
        const damage = async () => {
          await sleep(round % 10);
          return access.changeHp(row.id, -10, {
            sessionId: table.sessionId,
            playerId: table.member.id,
          });
        };
        const patch = () => sheetPatch(row.id, 0, { constitution: -5 });
        const patched =
          round % 2 === 0
            ? (await Promise.allSettled([patch(), damage()]))[0]
            : (await Promise.allSettled([damage(), patch()]))[1];
        const final = await readCharacter(row.id);
        const patchWon = patched?.status === 'fulfilled';
        const expected = patchWon
          ? { currentHp: 16, version: 2 }
          : { currentHp: 22, version: 1 };
        if (
          final.currentHp !== expected.currentHp ||
          final.version !== expected.version
        )
          lost.push(
            `round ${round}: patchWon=${patchWon} hp=${final.currentHp} version=${final.version}`,
          );
      }

      expect(lost).toEqual([]);
    });

    describe('4. POST /characters replay', () => {
      async function createCommand(clientRequestId: string) {
        return {
          gameId: table.gameId,
          clientRequestId,
          nickname: 'verify-created',
          cognition: -5,
          psyche: -5,
          instinct: -5,
          constitution: -5,
          motricity: -5,
          perception: -5,
          personality: 'Erudito',
          posture: 'Abrutalhado',
          socialClass: 'plebeu' as const,
          skills: [
            { skillId: await skillIdByName('Erudição'), proficiencyBonus: 1 },
            { skillId: await skillIdByName('Lógica'), proficiencyBonus: 1 },
          ],
        };
      }

      async function rowsFor(clientRequestId: string) {
        const rows = await db
          .select()
          .from(character)
          .where(eq(character.clientRequestId, clientRequestId));
        const skills = await db
          .select()
          .from(characterSkill)
          .where(
            inArray(
              characterSkill.characterId,
              rows.map((r) => r.id),
            ),
          );

        return { rows, skills };
      }

      it('sequential replay returns the same id with one set of skills', async () => {
        const clientRequestId = randomUUID();
        const command = await createCommand(clientRequestId);

        const first = await createCharacter.execute(table.member.id, command);
        const second = await createCharacter.execute(table.member.id, command);

        expect(second.id).toBe(first.id);
        const { rows, skills } = await rowsFor(clientRequestId);
        expect(rows).toHaveLength(1);
        expect(skills).toHaveLength(2);
      });

      it('concurrent replay of 5 returns the same id with one set of skills', async () => {
        const clientRequestId = randomUUID();
        const command = await createCommand(clientRequestId);

        const results = await Promise.all(
          Array.from({ length: 5 }, () =>
            createCharacter.execute(table.member.id, command),
          ),
        );

        expect(new Set(results.map((c) => c.id)).size).toBe(1);
        const { rows, skills } = await rowsFor(clientRequestId);
        expect(rows).toHaveLength(1);
        expect(skills).toHaveLength(2);
      });

      it('same clientRequestId from a different player creates a second row', async () => {
        const clientRequestId = randomUUID();
        const command = await createCommand(clientRequestId);

        const byMember = await createCharacter.execute(
          table.member.id,
          command,
        );
        const byMaster = await createCharacter.execute(
          table.master.id,
          command,
        );

        expect(byMaster.id).not.toBe(byMember.id);
        const { rows } = await rowsFor(clientRequestId);
        expect(rows).toHaveLength(2);
      });
    });

    it('5. concurrent POST /bestiary replay creates one monster', async () => {
      const clientRequestId = randomUUID();
      const command = {
        gameId: table.gameId,
        clientRequestId,
        name: 'verify-monster',
        np: 1,
        maxHp: 10,
        maxEffort: 5,
      };

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          createMonster.execute(table.master.id, command),
        ),
      );

      expect(new Set(results.map((m) => m.id)).size).toBe(1);
      const rows = await db
        .select()
        .from(monster)
        .where(
          and(
            eq(monster.createdBy, table.master.id),
            eq(monster.clientRequestId, clientRequestId),
          ),
        );
      expect(rows).toHaveLength(1);
    });
  },
);
