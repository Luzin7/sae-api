import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeMembership,
  makeNotifier,
} from '../character.testkit.js';
import { UpdateVitalsService } from './update-vitals.service.js';

describe('UpdateVitalsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clamps a current hp above the maximum to maxHp', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ maxHp: 28, currentEffort: 5, maxEffort: 10 }),
    );
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateVitalsService(
      characters,
      makeMembership(),
      makeNotifier(),
    ).execute('char-1', 'player-1', { currentHp: 99 });

    expect(characters.save).toHaveBeenCalledWith('char-1', {
      currentHp: 28,
      currentEffort: 5,
    });
  });

  it('clamps a negative hp to zero and leaves effort untouched', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ currentHp: 10, currentEffort: 4, maxEffort: 10 }),
    );
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateVitalsService(
      characters,
      makeMembership(),
      makeNotifier(),
    ).execute('char-1', 'player-1', { currentHp: -3 });

    expect(characters.save).toHaveBeenCalledWith('char-1', {
      currentHp: 0,
      currentEffort: 4,
    });
  });

  it('clamps effort above the maximum to maxEffort', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ currentHp: 12, maxHp: 20, maxEffort: 10 }),
    );
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateVitalsService(
      characters,
      makeMembership(),
      makeNotifier(),
    ).execute('char-1', 'player-1', { currentEffort: 42 });

    expect(characters.save).toHaveBeenCalledWith('char-1', {
      currentHp: 12,
      currentEffort: 10,
    });
  });

  it('lets the master change hp on another player character and pushes the frame', async () => {
    const characters = makeCharacterRepository();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner', currentHp: 10, maxHp: 30 }),
    );
    vi.mocked(characters.save).mockResolvedValue(
      makeCharacter({ playerId: 'owner', currentHp: 20, currentEffort: 0 }),
    );

    await new UpdateVitalsService(
      characters,
      makeMembership(),
      notifier,
    ).execute('char-1', 'master-1', { currentHp: 20 });

    expect(characters.save).toHaveBeenCalledWith('char-1', {
      currentHp: 20,
      currentEffort: 0,
    });
    expect(notifier.notifyHpChanged).toHaveBeenCalledWith('game-1', {
      characterId: 'char-1',
      oldHp: 10,
      newHp: 20,
    });
  });

  it('lets the master change effort on another player character without pushing a frame', async () => {
    const characters = makeCharacterRepository();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({
        playerId: 'owner',
        currentHp: 12,
        currentEffort: 5,
        maxEffort: 20,
      }),
    );
    vi.mocked(characters.save).mockResolvedValue(
      makeCharacter({ playerId: 'owner', currentHp: 12, currentEffort: 15 }),
    );

    await new UpdateVitalsService(
      characters,
      makeMembership(),
      notifier,
    ).execute('char-1', 'master-1', { currentEffort: 15 });

    expect(characters.save).toHaveBeenCalledWith('char-1', {
      currentHp: 12,
      currentEffort: 15,
    });
    expect(notifier.notifyHpChanged).not.toHaveBeenCalled();
  });

  it('lets the owner change their own character and pushes the frame', async () => {
    const characters = makeCharacterRepository();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ currentHp: 20 }),
    );
    vi.mocked(characters.save).mockResolvedValue(
      makeCharacter({ currentHp: 18 }),
    );

    await new UpdateVitalsService(
      characters,
      makeMembership(),
      notifier,
    ).execute('char-1', 'player-1', { currentHp: 18 });

    expect(notifier.notifyHpChanged).toHaveBeenCalledWith('game-1', {
      characterId: 'char-1',
      oldHp: 20,
      newHp: 18,
    });
  });

  it('forbids an unrelated player before saving or notifying', async () => {
    const characters = makeCharacterRepository();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );

    await expect(
      new UpdateVitalsService(characters, makeMembership(), notifier).execute(
        'char-1',
        'intruder',
        { currentHp: 1 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.save).not.toHaveBeenCalled();
    expect(notifier.notifyHpChanged).not.toHaveBeenCalled();
  });
});
