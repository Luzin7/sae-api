import { describe, expect, it } from 'vitest';
import { normalizeBonds } from './character.bonds.js';

describe('normalizeBonds', () => {
  it('trims, drops empty items and collapses case-insensitive duplicates', () => {
    expect(
      normalizeBonds('  irmão   mais velho , IRMÃO MAIS VELHO, ,'),
    ).toEqual(['Irmão Mais Velho']);
  });

  it('keeps accents and title-cases each word', () => {
    expect(normalizeBonds('coração, ÓDIO')).toEqual(['Coração', 'Ódio']);
  });

  it('title-cases a mixed-case tag', () => {
    expect(normalizeBonds('aLiAdO')).toEqual(['Aliado']);
  });

  it('dedupes case-insensitively keeping the first written form', () => {
    expect(normalizeBonds('Aliado, aliado, ALIADO')).toEqual(['Aliado']);
  });

  it('drops empty items and a trailing comma', () => {
    expect(normalizeBonds(' a , b ,')).toEqual(['A', 'B']);
  });

  it('returns an empty list for blank input', () => {
    expect(normalizeBonds('')).toEqual([]);
    expect(normalizeBonds(null)).toEqual([]);
    expect(normalizeBonds(undefined)).toEqual([]);
  });

  it('keeps a multi-word accented tag in title case per word', () => {
    expect(normalizeBonds('  ódio   mortal , ÓDIO MORTAL')).toEqual([
      'Ódio Mortal',
    ]);
  });
});
