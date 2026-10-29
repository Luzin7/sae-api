import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeMembership,
  makeNotifier,
} from '../character.testkit.js';
import { ChangeHpService } from './change-hp.service.js';

function build() {
  const characters = makeCharacterRepository();
  const notifier = makeNotifier();
  vi.mocked(characters.findById).mockResolvedValue(
    makeCharacter({ currentHp: 10, maxHp: 30 }),
  );
  vi.mocked(characters.changeHp).mockResolvedValue({
    character: makeCharacter({ currentHp: 15, maxHp: 30 }),
    oldEffort: 0,
    oldHp: 10,
  });

  return {
    characters,
    notifier,
    service: new ChangeHpService(characters, makeMembership(), notifier),
  };
}

describe('ChangeHpService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delta +5 from 10 returns the character at 15 and pushes hp-changed', async () => {
    const { characters, notifier, service } = build();

    const result = await service.execute('char-1', 'player-1', 5);

    expect(characters.changeHp).toHaveBeenCalledWith('char-1', 5);
    expect(result.currentHp).toBe(15);
    expect(notifier.notifyHpChanged).toHaveBeenCalledWith('game-1', {
      characterId: 'char-1',
      oldHp: 10,
      newHp: 15,
    });
  });

  it('pushes nothing when PS did not move', async () => {
    const { characters, notifier, service } = build();
    vi.mocked(characters.changeHp).mockResolvedValue({
      character: makeCharacter({ currentHp: 0 }),
      oldEffort: 0,
      oldHp: 0,
    });

    await service.execute('char-1', 'player-1', -1);

    expect(notifier.notifyHpChanged).not.toHaveBeenCalled();
  });

  it('lets the master change another player character', async () => {
    const { characters, service } = build();

    await service.execute('char-1', 'master-1', -3);

    expect(characters.changeHp).toHaveBeenCalledWith('char-1', -3);
  });

  it('forbids an unrelated player before writing or notifying', async () => {
    const { characters, notifier, service } = build();

    await expect(
      service.execute('char-1', 'intruder', 3),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.changeHp).not.toHaveBeenCalled();
    expect(notifier.notifyHpChanged).not.toHaveBeenCalled();
  });
});
