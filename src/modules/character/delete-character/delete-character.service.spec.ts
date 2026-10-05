import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import { makeCharacter, makeCharacterRepository } from '../character.testkit.js';
import { DeleteCharacterService } from './delete-character.service.js';

describe('DeleteCharacterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids deleting a character owned by another player', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );

    await expect(
      new DeleteCharacterService(characters).execute('char-1', 'intruder'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.delete).not.toHaveBeenCalled();
  });

  it('deletes the character for its owner', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.delete).mockResolvedValue(undefined);

    await new DeleteCharacterService(characters).execute('char-1', 'player-1');

    expect(characters.delete).toHaveBeenCalledWith('char-1');
  });
});
