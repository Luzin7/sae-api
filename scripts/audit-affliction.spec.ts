import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function audit(): string {
  return readFileSync(
    new URL('./audit-affliction.sql', import.meta.url),
    'utf8',
  );
}

describe('audit-affliction', () => {
  it('raises after the verdict when backfill is pending', () => {
    const sql = audit();

    const verdict = sql.indexOf("RAISE NOTICE 'verdict: %'");
    const guard = sql.indexOf('RAISE EXCEPTION');

    expect(verdict).toBeGreaterThanOrEqual(0);
    expect(guard).toBeGreaterThan(verdict);
    expect(sql).toContain('IF pending > 0 THEN');
    expect(sql).toContain('affliction backfill required: % rows');
  });
});
