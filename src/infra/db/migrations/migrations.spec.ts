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

describe('0008_flowery_paper_doll', () => {
  const sql = migration('./0008_flowery_paper_doll.sql');

  it('adds only nullable or defaulted columns', () => {
    expect(sql).toContain(
      'ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL',
    );
    expect(sql).toContain(
      'ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "client_request_id" uuid;',
    );
    expect(sql).toContain(
      'ALTER TABLE "monster" ADD COLUMN IF NOT EXISTS "client_request_id" uuid;',
    );
  });

  it('can run twice', () => {
    const statements = sql.split('--> statement-breakpoint');

    for (const statement of statements) {
      expect(statement).toContain('IF NOT EXISTS');
    }
  });

  it('scopes the idempotency keys to the creator', () => {
    expect(sql).toContain('("player_id","client_request_id")');
    expect(sql).toContain('("created_by","client_request_id")');
  });
});

describe('0009_pontos_de_esforco', () => {
  const sql = migration('./0009_pontos_de_esforco.sql');

  it('sets a lock timeout before touching any table', () => {
    expect(sql.startsWith("SET LOCAL lock_timeout = '5s';")).toBe(true);
  });

  it('aborts on a negative max_effort before adding the checks', () => {
    const guard = sql.indexOf('RAISE EXCEPTION');
    const firstCheck = sql.indexOf('ADD CONSTRAINT');

    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(firstCheck);
    expect(sql).toContain('"max_effort" < 0');
  });

  it('resets effort only together with adding its check', () => {
    const blocks = sql.split('--> statement-breakpoint').slice(2);

    expect(blocks).toHaveLength(3);
    for (const block of blocks) {
      expect(block).toContain('IF NOT EXISTS (SELECT 1 FROM pg_constraint');
      expect(block.indexOf('"current_effort" = 0')).toBeLessThan(
        block.indexOf('ADD CONSTRAINT'),
      );
    }
  });

  it('adds the range check to character, monster and combatant', () => {
    expect(sql).toContain('"character_effort_range_check"');
    expect(sql).toContain('"monster_effort_range_check"');
    expect(sql).toContain('"combatant_effort_range_check"');
    expect(sql).toContain(
      '"combatant"."current_effort" IS NULL OR "combatant"."max_effort" IS NULL',
    );
  });
});
