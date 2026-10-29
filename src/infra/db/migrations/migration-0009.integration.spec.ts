import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { integrationEnabled } from '@test/integration-env.js';
import { createSeed } from '@test/integration-db.js';
import { db } from '@infra/db/index.js';
import { character, combatant, monster } from '@infra/db/schema.js';

const CONSTRAINTS = [
  'character_effort_range_check',
  'monster_effort_range_check',
  'combatant_effort_range_check',
];
const MIGRATION_STATEMENTS = readFileSync(
  new URL('./0009_pontos_de_esforco.sql', import.meta.url),
  'utf8',
).split('--> statement-breakpoint');

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

class RollbackSignal extends Error {}

const { cleanupSeed, seedTable } = createSeed('migration-0009');

async function inRolledBackTransaction(
  work: (tx: Tx) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await work(tx);
      throw new RollbackSignal();
    });
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error;
  }
}

async function installedConstraints(executor: Tx | typeof db) {
  const rows = await executor.execute<{ conname: string }>(
    sql`SELECT conname FROM pg_constraint WHERE conname IN ('character_effort_range_check', 'monster_effort_range_check', 'combatant_effort_range_check')`,
  );

  return rows.map((row) => row.conname).sort();
}

async function dropConstraints(tx: Tx): Promise<void> {
  await tx.execute(
    sql`ALTER TABLE "character" DROP CONSTRAINT IF EXISTS character_effort_range_check`,
  );
  await tx.execute(
    sql`ALTER TABLE "monster" DROP CONSTRAINT IF EXISTS monster_effort_range_check`,
  );
  await tx.execute(
    sql`ALTER TABLE "combatant" DROP CONSTRAINT IF EXISTS combatant_effort_range_check`,
  );
}

async function runMigration(tx: Tx): Promise<void> {
  for (const statement of MIGRATION_STATEMENTS) {
    await tx.execute(sql.raw(statement));
  }
}

describe.skipIf(!integrationEnabled)('migration 0009 (real DB)', () => {
  afterAll(async () => {
    await cleanupSeed();
  });

  async function seedRows(tx: Tx, maxEffort: number) {
    const table = await seedTable();
    const [char] = await tx
      .insert(character)
      .values({
        playerId: table.member.id,
        gameId: table.gameId,
        nickname: `verify-migration-0009-${randomUUID()}`,
        maxHp: 26,
        currentHp: 26,
        maxEffort,
        currentEffort: 7,
      })
      .returning({ id: character.id });
    const [mon] = await tx
      .insert(monster)
      .values({
        createdBy: table.master.id,
        name: `verify-migration-0009-${randomUUID()}`,
        np: 1,
        maxHp: 10,
        currentHp: 10,
        maxEffort,
        currentEffort: 4,
      })
      .returning({ id: monster.id });
    const [comb] = await tx
      .insert(combatant)
      .values({
        sessionId: table.sessionId,
        kind: 'character',
        refId: randomUUID(),
        name: 'verify-migration-0009',
        maxEffort,
        currentEffort: 3,
      })
      .returning({ id: combatant.id });
    if (!char || !mon || !comb) throw new Error('seed failed');

    return { charId: char.id, monsterId: mon.id, combatantId: comb.id };
  }

  async function readEfforts(
    tx: Tx,
    ids: { charId: string; monsterId: string; combatantId: string },
  ) {
    const [char] = await tx
      .select({ effort: character.currentEffort })
      .from(character)
      .where(eq(character.id, ids.charId));
    const [mon] = await tx
      .select({ effort: monster.currentEffort })
      .from(monster)
      .where(eq(monster.id, ids.monsterId));
    const [comb] = await tx
      .select({ effort: combatant.currentEffort })
      .from(combatant)
      .where(eq(combatant.id, ids.combatantId));

    return [char?.effort, mon?.effort, comb?.effort];
  }

  it('first run resets effort to 0 and installs the three constraints', async () => {
    await inRolledBackTransaction(async (tx) => {
      await dropConstraints(tx);
      const ids = await seedRows(tx, 20);
      expect(await installedConstraints(tx)).toEqual([]);
      expect(await readEfforts(tx, ids)).toEqual([7, 4, 3]);

      await runMigration(tx);

      expect(await readEfforts(tx, ids)).toEqual([0, 0, 0]);
      expect(await installedConstraints(tx)).toEqual([...CONSTRAINTS].sort());
    });
  });

  it('second run leaves effort untouched', async () => {
    await inRolledBackTransaction(async (tx) => {
      await dropConstraints(tx);
      const ids = await seedRows(tx, 20);
      await runMigration(tx);
      await tx
        .update(character)
        .set({ currentEffort: 5 })
        .where(eq(character.id, ids.charId));

      await runMigration(tx);

      expect((await readEfforts(tx, ids))[0]).toBe(5);
    });
  });

  it('a negative max_effort aborts the run and changes nothing', async () => {
    await inRolledBackTransaction(async (tx) => {
      await dropConstraints(tx);
      const ids = await seedRows(tx, -1);

      await expect(
        tx.transaction(async (attempt) => runMigration(attempt)),
      ).rejects.toThrow(/negative max_effort/);

      expect(await readEfforts(tx, ids)).toEqual([7, 4, 3]);
      expect(await installedConstraints(tx)).toEqual([]);
    });
  });

  it('leaves the database in the migrated state', async () => {
    expect(await installedConstraints(db)).toEqual([...CONSTRAINTS].sort());
  });
});
