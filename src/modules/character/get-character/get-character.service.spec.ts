import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import { CharacterNotFoundError } from '../character.errors.js';
import { makeCharacter, makeCharacterRepository } from '../character.testkit.js';
import { GetCharacterService } from './get-character.service.js';

describe('GetCharacterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws CharacterNotFoundError when the character does not exist', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(null);

    await expect(
      new GetCharacterService(characters).execute('missing', 'player-1'),
    ).rejects.toBeInstanceOf(CharacterNotFoundError);
  });

  it('forbids reading a character owned by another player', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );

    await expect(
      new GetCharacterService(characters).execute('char-1', 'intruder'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('returns the character for its owner', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());

    const result = await new GetCharacterService(characters).execute(
      'char-1',
      'player-1',
    );

    expect(result.nickname).toBe('Hero');
  });
});
