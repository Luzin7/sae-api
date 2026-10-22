import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import { isForeignKeyViolation, isUniqueViolation } from './pg-errors.js';

const CONSTRAINT = 'session_log_test_roll_unique';

function pgError(code: string, constraint: string): Error {
  return Object.assign(new Error('pg'), {
    code,
    constraint_name: constraint,
  });
}

describe('isUniqueViolation', () => {
  it('unwraps the cause of a DrizzleQueryError', () => {
    const error = new DrizzleQueryError(
      'insert',
      [],
      pgError('23505', CONSTRAINT),
    );

    expect(isUniqueViolation(error, CONSTRAINT)).toBe(true);
  });

  it('matches the game invite code constraint', () => {
    const error = new DrizzleQueryError(
      'insert',
      [],
      pgError('23505', 'game_invite_code_unique'),
    );

    expect(isUniqueViolation(error, 'game_invite_code_unique')).toBe(true);
  });

  it('rejects another constraint', () => {
    const error = new DrizzleQueryError(
      'insert',
      [],
      pgError('23505', 'other'),
    );

    expect(isUniqueViolation(error, CONSTRAINT)).toBe(false);
  });

  it('rejects another error code', () => {
    const error = new DrizzleQueryError(
      'insert',
      [],
      pgError('23503', CONSTRAINT),
    );

    expect(isUniqueViolation(error, CONSTRAINT)).toBe(false);
  });

  it('rejects an error without cause and non-errors', () => {
    expect(isUniqueViolation(new Error('x'), CONSTRAINT)).toBe(false);
    expect(isUniqueViolation(null, CONSTRAINT)).toBe(false);
  });
});

describe('isForeignKeyViolation', () => {
  it('unwraps the cause of a DrizzleQueryError', () => {
    const error = new DrizzleQueryError(
      'insert',
      [],
      pgError('23503', CONSTRAINT),
    );

    expect(isForeignKeyViolation(error)).toBe(true);
    expect(isForeignKeyViolation(error, CONSTRAINT)).toBe(true);
  });

  it('rejects another constraint', () => {
    const error = new DrizzleQueryError(
      'insert',
      [],
      pgError('23503', 'other'),
    );

    expect(isForeignKeyViolation(error, CONSTRAINT)).toBe(false);
  });

  it('rejects another error code', () => {
    const error = new DrizzleQueryError(
      'insert',
      [],
      pgError('23505', CONSTRAINT),
    );

    expect(isForeignKeyViolation(error)).toBe(false);
  });

  it('rejects an unwrapped driver error, an error without cause and non-errors', () => {
    expect(isForeignKeyViolation(pgError('23503', CONSTRAINT))).toBe(false);
    expect(isForeignKeyViolation(new Error('x'))).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
  });
});
