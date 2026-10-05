import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeItem,
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

  it('adds the item for the owner', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.addItem).mockResolvedValue(makeItem());

    const input = { name: 'Knife', type: 'weapon' as const };
    const result = await new AddItemService(characters).execute(
      'char-1',
      'player-1',
      input,
    );

    expect(characters.addItem).toHaveBeenCalledWith('char-1', input);
    expect(result.name).toBe('Knife');
  });
});
