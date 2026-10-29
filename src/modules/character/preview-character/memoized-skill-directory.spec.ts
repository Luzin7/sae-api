import { describe, expect, it, vi } from 'vitest';
import type { PreviewCharacterBody } from '../character.schemas.js';
import { makeSkillSummary } from '../character.testkit.js';
import { SkillCatalogEmptyError } from '../character.errors.js';
import { MemoizedSkillDirectory } from './memoized-skill-directory.js';
import { PreviewCharacterService } from './preview-character.service.js';

const VITALIDADE = makeSkillSummary({ id: 'skill-vit', name: 'Vitalidade' });

describe('MemoizedSkillDirectory', () => {
  it('loads the catalog once across calls', async () => {
    const loader = vi.fn().mockResolvedValue([VITALIDADE]);
    const directory = new MemoizedSkillDirectory(loader);

    await directory.findSkillsByIds(['skill-vit']);
    await directory.findSkillsByIds(['skill-vit']);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('returns only the known ids', async () => {
    const directory = new MemoizedSkillDirectory(async () => [VITALIDADE]);

    const found = await directory.findSkillsByIds(['skill-vit', 'unknown']);

    expect(found).toEqual([VITALIDADE]);
  });

  it('retries the load after a failure', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce([VITALIDADE]);
    const directory = new MemoizedSkillDirectory(loader);

    await expect(directory.findSkillsByIds(['skill-vit'])).rejects.toThrow();
    const found = await directory.findSkillsByIds(['skill-vit']);

    expect(found).toEqual([VITALIDADE]);
    expect(loader).toHaveBeenCalledTimes(2);
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

  it('makes no database call for previews with skills after warm-up', async () => {
    const loader = vi.fn().mockResolvedValue([VITALIDADE]);
    const service = new PreviewCharacterService(
      new MemoizedSkillDirectory(loader),
    );
    const input: PreviewCharacterBody = {
      np: 1,
      constitution: 1,
      skills: [{ skillId: 'skill-vit', proficiencyBonus: 3 }],
    };

    await service.execute(input);
    loader.mockClear();
    await service.execute(input);
    await service.execute(input);

    expect(loader).not.toHaveBeenCalled();
  });
});
