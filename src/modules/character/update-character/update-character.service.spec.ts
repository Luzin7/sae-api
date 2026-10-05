import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { Rng } from '../character.derivation.js';
import {
  AttributeBudgetExceededError,
  InvalidAttributeError,
} from '../character.errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeSkillDetail,
} from '../character.testkit.js';
import { UpdateCharacterService } from './update-character.service.js';

function fixedRng(value: number): Rng {
  return () => value;
}

describe('UpdateCharacterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids updating a character owned by another player', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );

    await expect(
      new UpdateCharacterService(characters, fixedRng(1)).execute(
        'char-1',
        'intruder',
        { nickname: 'X' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects a sheet whose attributes exceed the np budget', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());

    await expect(
      new UpdateCharacterService(characters, fixedRng(1)).execute(
        'char-1',
        'player-1',
        { cognition: 5, psyche: 5, instinct: 5, motricity: 5 },
      ),
    ).rejects.toBeInstanceOf(AttributeBudgetExceededError);
  });

  it('rejects -1/0 as attribute values', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());

    await expect(
      new UpdateCharacterService(characters, fixedRng(1)).execute(
        'char-1',
        'player-1',
        { perception: 0 },
      ),
    ).rejects.toBeInstanceOf(InvalidAttributeError);
  });

  it('recomputes maxHp, maxEffort and bExp on a sheet change', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateCharacterService(characters, fixedRng(1)).execute(
      'char-1',
      'player-1',
      { np: 2, constitution: -2 },
    );

    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({
        np: 2,
        constitution: -2,
        maxHp: 20 + 2 * 8,
        maxEffort: 20,
        bExp: 1,
      }),
    );
  });

  it('adds the Vitalidade/Condicionamento skill bonuses to the vitals', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([
      makeSkillDetail({ skillName: 'Vitalidade', proficiencyBonus: 6 }),
      makeSkillDetail({
        skillId: '22222222-2222-2222-2222-222222222222',
        skillName: 'Condicionamento',
        proficiencyBonus: 4,
      }),
    ]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateCharacterService(characters, fixedRng(1)).execute(
      'char-1',
      'player-1',
      { np: 1 },
    );

    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ maxHp: 20 + 1 * 6 + 6, maxEffort: 24 }),
    );
  });

  it('clamps current vitals down to a reduced maximum', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ currentHp: 500, currentEffort: 500 }),
    );
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateCharacterService(characters, fixedRng(1)).execute(
      'char-1',
      'player-1',
      { np: 1 },
    );

    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ currentHp: 26, currentEffort: 20 }),
    );
  });

  it('re-derives proficiency levels when the archetype changes', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateCharacterService(characters, fixedRng(1)).execute(
      'char-1',
      'player-1',
      { personality: 'Erudito', posture: 'Abrutalhado' },
    );

    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({
        cognitionProficiency: 'especialista',
        constitutionProficiency: 'especialista',
        psycheProficiency: 'imperito',
      }),
    );
  });

  it('recomputes vaalaques only when the social class changes', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ socialClass: 'plebeu', vaalaques: 80 }),
    );
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateCharacterService(characters, fixedRng(1)).execute(
      'char-1',
      'player-1',
      { nickname: 'Renamed' },
    );
    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ vaalaques: 80 }),
    );

    vi.mocked(characters.save).mockClear();
    await new UpdateCharacterService(characters, fixedRng(1)).execute(
      'char-1',
      'player-1',
      { socialClass: 'opulento' },
    );
    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ socialClass: 'opulento', vaalaques: 2 * 720 }),
    );
  });
});
