import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import { CharacterItemNotFoundError } from '../../character.errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeItem,
} from '../../character.testkit.js';
import { UpdateItemService } from './update-item.service.js';

describe('UpdateItemService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws CharacterItemNotFoundError when the item does not exist', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findItemById).mockResolvedValue(null);

    await expect(
      new UpdateItemService(characters).execute('char-1', 'item-9', 'player-1', {
        name: 'X',
      }),
    ).rejects.toBeInstanceOf(CharacterItemNotFoundError);
  });

  it('forbids updating an item that belongs to another character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findItemById).mockResolvedValue(
      makeItem({ characterId: 'other-char' }),
    );

    await expect(
      new UpdateItemService(characters).execute('char-1', 'item-1', 'player-1', {
        name: 'X',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('updates the item when it belongs to the character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findItemById).mockResolvedValue(makeItem());
    vi.mocked(characters.updateItem).mockResolvedValue(
      makeItem({ name: 'Dagger' }),
    );

    const input = { name: 'Dagger' };
    const result = await new UpdateItemService(characters).execute(
      'char-1',
      'item-1',
      'player-1',
      input,
    );

    expect(characters.updateItem).toHaveBeenCalledWith('item-1', input);
    expect(result.name).toBe('Dagger');
  });
});
