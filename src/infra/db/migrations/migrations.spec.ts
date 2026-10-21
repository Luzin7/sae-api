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
