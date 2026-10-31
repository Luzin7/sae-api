import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeItem,
} from '../../character.testkit.js';
import { UpdateItemService } from './update-item.service.js';

describe('UpdateItemService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids updating an item that belongs to another character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findItemById).mockResolvedValue(
      makeItem({ characterId: 'other-char' }),
    );

    await expect(
      new UpdateItemService(characters).execute(
        'char-1',
        'item-1',
        'player-1',
        {
          name: 'X',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
