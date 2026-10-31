import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
} from '../../character.testkit.js';
import { AddItemService } from './add-item.service.js';

describe('AddItemService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids adding an item to a character owned by another player', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );

    await expect(
      new AddItemService(characters).execute('char-1', 'intruder', {
        name: 'Knife',
        type: 'weapon',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
