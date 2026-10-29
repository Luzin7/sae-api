import { describe, expect, it } from 'vitest';
import { pickUniqueValue } from './initiative.js';

function sequenced(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;

    return value ?? 1;
  };
}

describe('pickUniqueValue', () => {
  it('skips values already taken', () => {
    expect(pickUniqueValue([3], sequenced([3, 5]))).toBe(5);
  });

  it('falls back to the first free face when attempts are exhausted', () => {
    const roll = sequenced([3]);
    const value = pickUniqueValue([3], roll);

    expect(value).toBe(1);
    expect(value).not.toBe(3);
  });

  it('returns a single plain roll when every face is taken', () => {
    const taken = Array.from({ length: 20 }, (_, index) => index + 1);
    let calls = 0;
    const roll = () => {
      calls += 1;

      return 3;
    };

    expect(pickUniqueValue(taken, roll)).toBe(3);
    expect(calls).toBe(1);
  });
});
