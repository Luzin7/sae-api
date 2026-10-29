import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationEnabled } from '@test/integration-env.js';
import {
  createSeed,
  skillIdByName,
  type SeededTable,
} from '@test/integration-db.js';
import { db } from '@infra/db/index.js';
import { character, characterSkill } from '@infra/db/schema.js';
import { advancementBalance } from '@modules/character/character.advancement.js';
import { CharacterVersionConflictError } from '@modules/character/character.errors.js';
import { AdvanceCharacterService } from '@modules/character/advance-character/advance-character.service.js';
import { UpdateCharacterService } from '@modules/character/update-character/update-character.service.js';
import { systemRng } from '@shared/dice/random.js';
import { characterRepository } from './character.repository.js';
import { gameAccessRepository } from './game-access.repository.js';
import { toCharacter } from './character.repository.mappers.js';

const notifier = {
  notifyRosterChanged: async () => undefined,
  notifyHpChanged: async () => undefined,
  notifyEffortChanged: async () => undefined,
  notifyNpChanged: async () => undefined,
  notifyCharacterAdvanced: async () => undefined,
  notifyCombatChanged: async () => undefined,
};
const ROUNDS = 20;
const SPENT_20_AT_NP2 = {
  np: 2,
  cognition: 5,
  psyche: 4,
  instinct: 2,
} as const;

const { cleanupSeed, seedCharacter, seedTable } = createSeed(
  'character-advancement',
);

describe.skipIf(!integrationEnabled)('character advancement (real DB)', () => {
  const characters = characterRepository();
  const advance = new AdvanceCharacterService(characters, notifier);
  const update = new UpdateCharacterService(
    characters,
    gameAccessRepository(),
    systemRng,
    notifier,
  );
  let table: SeededTable;

  beforeAll(async () => {
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

  it('Mestre lowering NP against a player advancement: exactly one wins and the spend fits', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const row = await seedCharacter(table, SPENT_20_AT_NP2);
      const results = await Promise.allSettled([
        update.execute(row.id, table.master.id, { version: 0, np: 1 }),
        advance.execute(row.id, table.member.id, {
          version: 0,
          attributes: { instinct: 3 },
          skills: [],
        }),
      ]);

      const losers = results.filter((r) => r.status === 'rejected');
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(losers[0]?.reason).toBeInstanceOf(CharacterVersionConflictError);
      const final = await readCharacter(row.id);
      const spend = await characters.findSkillSpend([row.id]);
      const balance = advancementBalance(toCharacter(final), spend);
      expect(final.version).toBe(1);
      expect(balance.attributePoints.remaining).toBeGreaterThanOrEqual(0);
      for (const pool of Object.values(balance.skillPoints)) {
        expect(pool.remaining).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('replaying the same body and version is a conflict and writes nothing twice', async () => {
    const skillId = await skillIdByName('Vitalidade');
    const row = await seedCharacter(table, {
      np: 2,
      constitutionProficiency: 'competente',
    });
    const body = {
      version: 0,
      attributes: { constitution: -4 },
      skills: [{ skillId, proficiencyBonus: 2 }],
    } as const;

    await advance.execute(row.id, table.member.id, {
      ...body,
      skills: [...body.skills],
    });
    await expect(
      advance.execute(row.id, table.member.id, {
        ...body,
        skills: [...body.skills],
      }),
    ).rejects.toBeInstanceOf(CharacterVersionConflictError);

    const final = await readCharacter(row.id);
    const saved = await db
      .select()
      .from(characterSkill)
      .where(eq(characterSkill.characterId, row.id));
    expect(final.version).toBe(1);
    expect(final.constitution).toBe(-4);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.proficiencyBonus).toBe(2);
    expect(final.maxHp).toBe(20 + 2 * 6 + 2);
  });

  it('Mestre lowering Constituição clamps current PS to the new max in SQL', async () => {
    const row = await seedCharacter(table, {
      np: 2,
      constitution: 1,
      maxHp: 40,
      currentHp: 40,
    });

    await update.execute(row.id, table.master.id, {
      version: 0,
      constitution: -4,
    });

    const final = await readCharacter(row.id);
    expect(final.maxHp).toBe(32);
    expect(final.currentHp).toBe(32);
  });

  it('advancing Condicionamento raises maxEffort and keeps current PE', async () => {
    const skillId = await skillIdByName('Condicionamento');
    const row = await seedCharacter(table, {
      np: 2,
      constitutionProficiency: 'competente',
      maxEffort: 20,
      currentEffort: 7,
    });

    await advance.execute(row.id, table.member.id, {
      version: 0,
      attributes: {},
      skills: [{ skillId, proficiencyBonus: 2 }],
    });

    const final = await readCharacter(row.id);
    expect(final.maxEffort).toBe(22);
    expect(final.currentEffort).toBe(7);
  });

  it('a Mestre who does not own the sheet cannot advance it', async () => {
    const row = await seedCharacter(table, SPENT_20_AT_NP2);

    await expect(
      advance.execute(row.id, table.master.id, {
        version: 0,
        attributes: { instinct: 3 },
        skills: [],
      }),
    ).rejects.toThrow();
    expect((await readCharacter(row.id)).instinct).toBe(2);
  });
});
