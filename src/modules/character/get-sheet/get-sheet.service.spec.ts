import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
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
    expect(result.character.advancement.attributePoints.remaining).toBe(20);
    expect(result.items).toHaveLength(1);
    expect(result.skills[0]?.skillName).toBe('Vitalidade');
    expect(result.skills[0]?.attribute).toBe('constitution');
  });
});
