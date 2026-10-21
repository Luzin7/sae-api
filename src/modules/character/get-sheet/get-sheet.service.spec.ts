import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import { CharacterNotFoundError } from '../character.errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeItem,
  makeMembership,
  makeSkillDetail,
} from '../character.testkit.js';
import { GetSheetService } from './get-sheet.service.js';

describe('GetSheetService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws CharacterNotFoundError when the character does not exist', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(null);

    await expect(
      new GetSheetService(characters, makeMembership()).execute(
        'missing',
        'player-1',
      ),
    ).rejects.toBeInstanceOf(CharacterNotFoundError);
    expect(characters.findItems).not.toHaveBeenCalled();
  });

  it('forbids a player who is neither owner nor master', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );

    await expect(
      new GetSheetService(characters, makeMembership()).execute(
        'char-1',
        'intruder',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.findItems).not.toHaveBeenCalled();
  });

  it('returns character, items and skill details for the owner', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findItems).mockResolvedValue([makeItem()]);
    vi.mocked(characters.findSkillDetails).mockResolvedValue([
      makeSkillDetail(),
    ]);

    const result = await new GetSheetService(
      characters,
      makeMembership(),
    ).execute('char-1', 'player-1');

    expect(result.character.id).toBe('char-1');
    expect(result.items).toHaveLength(1);
    expect(result.skills[0]?.skillName).toBe('Vitalidade');
    expect(result.skills[0]?.attribute).toBe('constitution');
  });

  it('returns the sheet to the game master', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );
    vi.mocked(characters.findItems).mockResolvedValue([]);
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    const access = makeMembership();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    const result = await new GetSheetService(characters, access).execute(
      'char-1',
      'master-1',
    );

    expect(result.character.playerId).toBe('owner');
    expect(result.items).toEqual([]);
    expect(result.skills).toEqual([]);
  });
});
