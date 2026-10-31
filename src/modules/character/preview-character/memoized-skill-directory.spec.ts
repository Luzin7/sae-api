import { describe, expect, it, vi } from 'vitest';
import { makeSkillSummary } from '../character.testkit.js';
import { SkillCatalogEmptyError } from '../character.errors.js';
import { MemoizedSkillDirectory } from './memoized-skill-directory.js';

const VITALIDADE = makeSkillSummary({ id: 'skill-vit', name: 'Vitalidade' });

describe('MemoizedSkillDirectory', () => {
  it('returns only the known ids', async () => {
    const directory = new MemoizedSkillDirectory(async () => [VITALIDADE]);

    const found = await directory.findSkillsByIds(['skill-vit', 'unknown']);

    expect(found).toEqual([VITALIDADE]);
  });

  it('rejects an empty catalog and reloads on the next call', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([VITALIDADE]);
    const directory = new MemoizedSkillDirectory(loader);

    await expect(
      directory.findSkillsByIds(['skill-vit']),
    ).rejects.toBeInstanceOf(SkillCatalogEmptyError);
    const found = await directory.findSkillsByIds(['skill-vit']);

    expect(found).toEqual([VITALIDADE]);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
