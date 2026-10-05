import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCharacter, makeCharacterRepository } from '../character.testkit.js';
import { UpdateVitalsService } from './update-vitals.service.js';

describe('UpdateVitalsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clamps a current hp above the maximum to maxHp', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ maxHp: 28, currentEffort: 5, maxEffort: 10 }),
    );
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateVitalsService(characters).execute('char-1', 'player-1', {
      currentHp: 99,
    });

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

    await new UpdateVitalsService(characters).execute('char-1', 'player-1', {
      currentHp: -3,
    });

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

    await new UpdateVitalsService(characters).execute('char-1', 'player-1', {
      currentEffort: 42,
    });

    expect(characters.save).toHaveBeenCalledWith('char-1', {
      currentHp: 12,
      currentEffort: 10,
    });
  });
});
