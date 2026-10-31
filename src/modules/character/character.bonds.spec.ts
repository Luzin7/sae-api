import { describe, expect, it } from 'vitest';
import { normalizeBonds } from './character.bonds.js';

describe('normalizeBonds', () => {
  it('trims, drops empty items and collapses case-insensitive duplicates', () => {
    expect(
      normalizeBonds('  irmão   mais velho , IRMÃO MAIS VELHO, ,'),
    ).toEqual(['Irmão Mais Velho']);
  });

  it('dedupes case-insensitively keeping the first written form', () => {
    expect(normalizeBonds('Aliado, aliado, ALIADO')).toEqual(['Aliado']);
  });
});
