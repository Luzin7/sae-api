import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeItem,
} from '../../character.testkit.js';
import { DeleteItemService } from './delete-item.service.js';

describe('DeleteItemService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids deleting an item that belongs to another character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findItemById).mockResolvedValue(
      makeItem({ characterId: 'other-char' }),
    );

    await expect(
      new DeleteItemService(characters).execute('char-1', 'item-1', 'player-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.deleteItem).not.toHaveBeenCalled();
  });

  it('deletes the item when it belongs to the character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findItemById).mockResolvedValue(makeItem());
    vi.mocked(characters.deleteItem).mockResolvedValue(undefined);

    await new DeleteItemService(characters).execute(
      'char-1',
      'item-1',
      'player-1',
    );

    expect(characters.deleteItem).toHaveBeenCalledWith('item-1');
  });
});
