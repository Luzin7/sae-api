import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeItem,
  makeMembership,
  makeSkill,
} from './character.testkit.js';
import { CharacterQueryService } from './character-query.service.js';

describe('CharacterQueryService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists the characters owned by a player', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findByPlayer).mockResolvedValue([makeCharacter()]);

    const result = await new CharacterQueryService(
      characters,
      makeMembership(),
    ).listMine('player-1', { limit: 20, offset: 0 });

    expect(characters.findByPlayer).toHaveBeenCalledWith('player-1', {
      limit: 20,
      offset: 0,
    });
    expect(result).toHaveLength(1);
  });

  it('forbids listing a game the requester does not belong to', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(false);
    const query = new CharacterQueryService(characters, membership);

    await expect(query.listByGame('game-1', 'player-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(characters.findByGame).not.toHaveBeenCalled();
  });

  it('allows the game master who is not a member to list a game', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'player-1',
    });
    vi.mocked(membership.isMember).mockResolvedValue(false);
    vi.mocked(characters.findByGame).mockResolvedValue([makeCharacter()]);
    const query = new CharacterQueryService(characters, membership);

    const result = await query.listByGame('game-1', 'player-1');

    expect(characters.findByGame).toHaveBeenCalledWith('game-1');
    expect(result).toHaveLength(1);
  });

  it('lists items of an owned character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findItems).mockResolvedValue([makeItem()]);

    const result = await new CharacterQueryService(
      characters,
      makeMembership(),
    ).listItems('char-1', 'player-1');

    expect(characters.findItems).toHaveBeenCalledWith('char-1');
    expect(result[0]?.name).toBe('Knife');
  });

  it('lists skills of an owned character', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findSkills).mockResolvedValue([makeSkill()]);

    const result = await new CharacterQueryService(
      characters,
      makeMembership(),
    ).listSkills('char-1', 'player-1');

    expect(characters.findSkills).toHaveBeenCalledWith('char-1');
    expect(result).toHaveLength(1);
  });
});
