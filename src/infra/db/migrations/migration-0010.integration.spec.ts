import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { integrationEnabled } from '@test/integration-env.js';
import { createSeed } from '@test/integration-db.js';
import { db } from '@infra/db/index.js';
import { monster } from '@infra/db/schema.js';
import type { SizeCategoryKey } from '@shared/rules/size.js';

const CONSTRAINT = 'monster_size_check';
const MIGRATION_STATEMENTS = readFileSync(
  new URL('./0010_monster_size_categories.sql', import.meta.url),
  'utf8',
).split('--> statement-breakpoint');

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

class RollbackSignal extends Error {}

const { cleanupSeed, seedTable } = createSeed('migration-0010');

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

async function dropConstraint(tx: Tx): Promise<void> {
  await tx.execute(
    sql`ALTER TABLE "monster" DROP CONSTRAINT IF EXISTS monster_size_check`,
  );
}

async function constraintCount(executor: Tx | typeof db): Promise<number> {
  const rows = await executor.execute(
    sql`SELECT 1 FROM pg_constraint WHERE conname = ${CONSTRAINT}`,
  );

  return rows.length;
}

async function runMigration(tx: Tx): Promise<void> {
  for (const statement of MIGRATION_STATEMENTS) {
    await tx.execute(sql.raw(statement));
  }
}

describe.skipIf(!integrationEnabled)('migration 0010 (real DB)', () => {
  afterAll(async () => {
    await cleanupSeed();
  });

  async function seedMonster(tx: Tx, size: string | null): Promise<string> {
    const table = await seedTable();
    const [row] = await tx
      .insert(monster)
      .values({
        createdBy: table.master.id,
        name: `verify-migration-0010-${randomUUID()}`,
        np: 1,
        maxHp: 10,
        currentHp: 10,
        maxEffort: 5,
        size: size as SizeCategoryKey | null,
      })
      .returning({ id: monster.id });
    if (!row) throw new Error('seed failed');

    return row.id;
  }

  async function readSize(tx: Tx, id: string): Promise<string | null> {
    const [row] = await tx
      .select({ size: monster.size })
      .from(monster)
      .where(eq(monster.id, id));

    return row?.size ?? null;
  }

  it('maps Médio, GRANDE and gigante to medio, grande and NULL', async () => {
    await inRolledBackTransaction(async (tx) => {
      await dropConstraint(tx);
      const medium = await seedMonster(tx, 'Médio');
      const large = await seedMonster(tx, 'GRANDE');
      const unknown = await seedMonster(tx, 'gigante');
      const tiny = await seedMonster(tx, ' Miúdo ');

      await runMigration(tx);

      expect(await readSize(tx, medium)).toBe('medio');
      expect(await readSize(tx, large)).toBe('grande');
      expect(await readSize(tx, unknown)).toBeNull();
      expect(await readSize(tx, tiny)).toBe('miudo');
      expect(await constraintCount(tx)).toBe(1);
    });
  });

  it('second run is a no-op and keeps the mapped values', async () => {
    await inRolledBackTransaction(async (tx) => {
      await dropConstraint(tx);
      const medium = await seedMonster(tx, 'Médio');

      await runMigration(tx);
      await runMigration(tx);

      expect(await readSize(tx, medium)).toBe('medio');
      expect(await constraintCount(tx)).toBe(1);
    });
  });

  it('the constraint rejects a size outside the official keys', async () => {
    await inRolledBackTransaction(async (tx) => {
      await dropConstraint(tx);
      await runMigration(tx);

      await expect(
        tx.transaction(async (attempt) => seedMonster(attempt, 'gigante')),
      ).rejects.toThrow();
    });
  });

  it('leaves the database in the migrated state', async () => {
    expect(await constraintCount(db)).toBe(1);
  });
});
