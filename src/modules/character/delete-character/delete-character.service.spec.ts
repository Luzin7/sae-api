import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeMembership,
  makeNotifier,
} from '../character.testkit.js';
import { CharacterNotFoundError } from '../character.errors.js';
import { DeleteCharacterService } from './delete-character.service.js';

describe('DeleteCharacterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids a non-master from deleting their own sheet', async () => {
    const characters = makeCharacterRepository();
    const access = makeMembership();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'player-1' }),
    );

    await expect(
      new DeleteCharacterService(characters, access, notifier).execute(
        'char-1',
        'player-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.delete).not.toHaveBeenCalled();
    expect(notifier.notifyRosterChanged).not.toHaveBeenCalled();
  });

  it('forbids a non-master from deleting another sheet of the same table', async () => {
    const characters = makeCharacterRepository();
    const access = makeMembership();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'player-1' }),
    );

    await expect(
      new DeleteCharacterService(characters, access, notifier).execute(
        'char-1',
        'player-2',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.delete).not.toHaveBeenCalled();
    expect(notifier.notifyRosterChanged).not.toHaveBeenCalled();
  });

  it('forbids the master of another table from deleting this sheet', async () => {
    const characters = makeCharacterRepository();
    const access = makeMembership();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ gameId: 'game-1' }),
    );
    vi.mocked(access.findById).mockImplementation(async (gameId) =>
      gameId === 'game-2'
        ? { id: 'game-2', masterId: 'master-2' }
        : { id: 'game-1', masterId: 'master-1' },
    );

    await expect(
      new DeleteCharacterService(characters, access, notifier).execute(
        'char-1',
        'master-2',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.delete).not.toHaveBeenCalled();
    expect(notifier.notifyRosterChanged).not.toHaveBeenCalled();
  });

  it('rejects deleting a missing sheet', async () => {
    const characters = makeCharacterRepository();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(null);

    await expect(
      new DeleteCharacterService(
        characters,
        makeMembership(),
        notifier,
      ).execute('missing', 'master-1'),
    ).rejects.toBeInstanceOf(CharacterNotFoundError);
    expect(characters.delete).not.toHaveBeenCalled();
  });

  it('lets the master delete a sheet of their table', async () => {
    const characters = makeCharacterRepository();
    const access = makeMembership();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'player-1' }),
    );
    vi.mocked(characters.delete).mockResolvedValue(undefined);

    await new DeleteCharacterService(characters, access, notifier).execute(
      'char-1',
      'master-1',
    );

    expect(characters.delete).toHaveBeenCalledWith('char-1');
    expect(notifier.notifyRosterChanged).toHaveBeenCalledWith('game-1');
  });
});
