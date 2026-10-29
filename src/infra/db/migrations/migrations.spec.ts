import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function migration(file: string): string {
  return readFileSync(new URL(file, import.meta.url), 'utf8');
}

describe('0004_blue_pepper_potts', () => {
  it('copies affliction into afflictions before dropping the old column', () => {
    const sql = migration('./0004_blue_pepper_potts.sql');

    const added = sql.indexOf('ADD COLUMN "afflictions"');
    const backfilled = sql.indexOf('SET "afflictions" = ARRAY["affliction"]');
    const dropped = sql.indexOf('DROP COLUMN IF EXISTS "affliction"');

    expect(added).toBeGreaterThanOrEqual(0);
    expect(backfilled).toBeGreaterThan(added);
    expect(dropped).toBeGreaterThan(backfilled);
  });

  it('aborts between the backfill and the drop when a row would be lost', () => {
    const sql = migration('./0004_blue_pepper_potts.sql');

    const backfilled = sql.indexOf('SET "afflictions" = ARRAY["affliction"]');
    const guard = sql.indexOf('RAISE EXCEPTION');
    const dropped = sql.indexOf('DROP COLUMN IF EXISTS "affliction"');

    expect(guard).toBeGreaterThan(backfilled);
    expect(guard).toBeLessThan(dropped);
    expect(sql).toContain('"affliction" IS NOT NULL AND "afflictions" IS NULL');
  });
});

describe('0005_testes_sessao', () => {
  const sql = migration('./0005_testes_sessao.sql');

  it('references test_closed only in the ALTER TYPE', () => {
    const occurrences = sql.match(/test_closed/g) ?? [];

    expect(occurrences).toHaveLength(1);
    expect(sql).toContain(
      `ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'test_closed'`,
    );
  });

  it('requires both keys to be present in the unique index predicate', () => {
    expect(sql).toContain("(payload->>'testId') IS NOT NULL");
    expect(sql).toContain("(payload->>'characterId') IS NOT NULL");
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
  });
});

describe('reusable bestiary entries migration', () => {
  const sql = migration('./0007_wealthy_gamma_corps.sql');

  it('backfills created_by before enforcing NOT NULL', () => {
    const backfilled = sql.search(/UPDATE "monster"[\s\S]*?SET "created_by"/);
    const notNull = sql.indexOf('ALTER COLUMN "created_by" SET NOT NULL');

    expect(backfilled).toBeGreaterThanOrEqual(0);
    expect(notNull).toBeGreaterThan(backfilled);
  });

  it('aborts between the backfill and NOT NULL when a row has no owner', () => {
    const backfilled = sql.search(/UPDATE "monster"[\s\S]*?SET "created_by"/);
    const guard = sql.indexOf('RAISE EXCEPTION');
    const notNull = sql.indexOf('ALTER COLUMN "created_by" SET NOT NULL');

    expect(guard).toBeGreaterThan(backfilled);
    expect(guard).toBeLessThan(notNull);
    expect(sql).toContain('"created_by" IS NULL');
  });
});
