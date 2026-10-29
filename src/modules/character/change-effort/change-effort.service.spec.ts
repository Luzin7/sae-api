import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeMembership,
  makeNotifier,
} from '../character.testkit.js';
import { ChangeEffortService } from './change-effort.service.js';

function build() {
  const characters = makeCharacterRepository();
  const notifier = makeNotifier();
  vi.mocked(characters.findById).mockResolvedValue(
    makeCharacter({ currentEffort: 5, maxEffort: 20 }),
  );
  vi.mocked(characters.changeEffort).mockResolvedValue({
    character: makeCharacter({ currentEffort: 8 }),
    oldEffort: 5,
    oldHp: 26,
  });

  return {
    characters,
    notifier,
    service: new ChangeEffortService(characters, makeMembership(), notifier),
  };
}

describe('ChangeEffortService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delta +3 from 5 PE returns the character at 8 and pushes pe-changed', async () => {
    const { characters, notifier, service } = build();

    const result = await service.execute('char-1', 'master-1', 3);

    expect(characters.changeEffort).toHaveBeenCalledWith('char-1', 3);
    expect(result.currentEffort).toBe(8);
    expect(notifier.notifyEffortChanged).toHaveBeenCalledWith('game-1', {
      characterId: 'char-1',
      oldPe: 5,
      newPe: 8,
    });
    expect(notifier.notifyHpChanged).not.toHaveBeenCalled();
  });

  it('pushes hp-changed when the excess cost PS', async () => {
    const { characters, notifier, service } = build();
    vi.mocked(characters.changeEffort).mockResolvedValue({
      character: makeCharacter({ currentEffort: 20, currentHp: 23 }),
      oldEffort: 18,
      oldHp: 26,
    });

    await service.execute('char-1', 'master-1', 5);

    expect(notifier.notifyHpChanged).toHaveBeenCalledWith('game-1', {
      characterId: 'char-1',
      oldHp: 26,
      newHp: 23,
    });
  });

  it('lets the master change another player character', async () => {
    const { characters, service } = build();

    await service.execute('char-1', 'master-1', 1);

    expect(characters.changeEffort).toHaveBeenCalledWith('char-1', 1);
  });

  it('forbids the character owner before writing or notifying', async () => {
    const { characters, notifier, service } = build();

    await expect(
      service.execute('char-1', 'player-1', 3),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.changeEffort).not.toHaveBeenCalled();
    expect(notifier.notifyEffortChanged).not.toHaveBeenCalled();
  });

  it('forbids an unrelated player before writing or notifying', async () => {
    const { characters, notifier, service } = build();

    await expect(
      service.execute('char-1', 'intruder', 3),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.changeEffort).not.toHaveBeenCalled();
    expect(notifier.notifyEffortChanged).not.toHaveBeenCalled();
  });
});
