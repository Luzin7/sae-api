import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { Rng } from '../character.derivation.js';
import {
  AttributeBudgetExceededError,
  InvalidAttributeError,
  InvalidHeightError,
  InvalidWeightError,
  NpMasterOnlyError,
  SkillPoolExceededError,
} from '../character.errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeMembership,
  makeNotifier,
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
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );

    await expect(
      new UpdateCharacterService(
        characters,
        makeMembership(),
        fixedRng(1),
        notifier,
      ).execute('char-1', 'intruder', { nickname: 'X' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(notifier.notifyRosterChanged).not.toHaveBeenCalled();
  });

  it('notifies the live roster after saving', async () => {
    const characters = makeCharacterRepository();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(
      makeCharacter({ playerId: 'other-player' }),
    );

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      notifier,
    ).execute('char-1', 'master-1', { nickname: 'Renamed' });

    expect(notifier.notifyRosterChanged).toHaveBeenCalledWith('game-1');
  });

  it('rejects a sheet whose attributes exceed the np budget', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());

    await expect(
      new UpdateCharacterService(
        characters,
        makeMembership(),
        fixedRng(1),
        makeNotifier(),
      ).execute('char-1', 'player-1', {
        cognition: 5,
        psyche: 5,
        instinct: 5,
        motricity: 5,
      }),
    ).rejects.toBeInstanceOf(AttributeBudgetExceededError);
  });

  it('rejects -1/0 as attribute values', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());

    await expect(
      new UpdateCharacterService(
        characters,
        makeMembership(),
        fixedRng(1),
        makeNotifier(),
      ).execute('char-1', 'player-1', { perception: 0 }),
    ).rejects.toBeInstanceOf(InvalidAttributeError);
  });

  it('recomputes maxHp, maxEffort and bExp on a sheet change', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'master-1', { np: 2, constitution: -2 });

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
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ constitutionProficiency: 'especialista' }),
    );
    vi.mocked(characters.findSkillDetails).mockResolvedValue([
      makeSkillDetail({ skillName: 'Vitalidade', proficiencyBonus: 6 }),
      makeSkillDetail({
        skillId: '22222222-2222-2222-2222-222222222222',
        skillName: 'Condicionamento',
        proficiencyBonus: 4,
      }),
    ]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'master-1', { np: 1 });

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

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'master-1', { np: 1 });

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

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'player-1', {
      personality: 'Erudito',
      posture: 'Abrutalhado',
    });

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

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'player-1', { nickname: 'Renamed' });
    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ vaalaques: 80 }),
    );

    vi.mocked(characters.save).mockClear();
    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'player-1', { socialClass: 'opulento' });
    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ socialClass: 'opulento', vaalaques: 2 * 720 }),
    );
  });

  it('persists the resolved roll and derives the size from it', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ heightCm: 160, weightKg: 60, size: 'pequeno' }),
    );
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'player-1', { heightRoll: 'max' });

    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({
        heightCm: 251,
        weightKg: 60,
        size: 'medio',
      }),
    );
  });

  it('keeps the current appearance when nothing is informed', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ heightCm: 160, weightKg: 60, size: 'pequeno' }),
    );
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'player-1', { nickname: 'Renamed' });

    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({
        heightCm: 160,
        weightKg: 60,
        size: 'pequeno',
      }),
    );
  });

  it('rejects an ambiguous height update', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);

    await expect(
      new UpdateCharacterService(
        characters,
        makeMembership(),
        fixedRng(1),
        makeNotifier(),
      ).execute('char-1', 'player-1', { heightCm: 160, heightRoll: 'min' }),
    ).rejects.toBeInstanceOf(InvalidHeightError);
  });

  it('rejects an exact weight outside the 50..150 band', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);

    await expect(
      new UpdateCharacterService(
        characters,
        makeMembership(),
        fixedRng(1),
        makeNotifier(),
      ).execute('char-1', 'player-1', { weightKg: 151 }),
    ).rejects.toBeInstanceOf(InvalidWeightError);
  });

  it('forbids the owner from changing np', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());

    await expect(
      new UpdateCharacterService(
        characters,
        makeMembership(),
        fixedRng(1),
        makeNotifier(),
      ).execute('char-1', 'player-1', { np: 2 }),
    ).rejects.toBeInstanceOf(NpMasterOnlyError);
  });

  it('allows the master to change np and recomputes bExp and maxHp', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.save).mockResolvedValue(makeCharacter());

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'master-1', { np: 2 });

    expect(characters.save).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ np: 2, bExp: 1, maxHp: 20 + 2 * 6 }),
    );
  });

  it('rejects an np reduction that leaves a skill pool exceeded', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter({ np: 5 }));
    vi.mocked(characters.findSkillDetails).mockResolvedValue([
      makeSkillDetail({ proficiencyBonus: 6 }),
    ]);

    await expect(
      new UpdateCharacterService(
        characters,
        makeMembership(),
        fixedRng(1),
        makeNotifier(),
      ).execute('char-1', 'master-1', { np: 3 }),
    ).rejects.toBeInstanceOf(SkillPoolExceededError);
  });
});
