import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import { CharacterNotFoundError } from '../character.errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeMembership,
} from '../character.testkit.js';
import { GetCharacterService } from './get-character.service.js';

describe('GetCharacterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws CharacterNotFoundError when the character does not exist', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(null);

    await expect(
      new GetCharacterService(characters, makeMembership()).execute(
        'missing',
        'player-1',
      ),
    ).rejects.toBeInstanceOf(CharacterNotFoundError);
  });

  it('forbids reading a character of another player in a game the requester does not master', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );

    await expect(
      new GetCharacterService(characters, makeMembership()).execute(
        'char-1',
        'intruder',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('returns the character for its owner', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());

    const result = await new GetCharacterService(
      characters,
      makeMembership(),
    ).execute('char-1', 'player-1');

    expect(result.character.nickname).toBe('Hero');
    expect(result.advancement.attributePoints.budget).toBe(20);
  });

  it('returns the character for the game master', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );
    const access = makeMembership();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    const result = await new GetCharacterService(characters, access).execute(
      'char-1',
      'master-1',
    );

    expect(result.character.id).toBe('char-1');
  });
});
