import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { Rng } from '../character.derivation.js';
import {
  AttributeBudgetExceededError,
  InvalidArchetypeError,
  InvalidAttributeError,
  InvalidHeightError,
  SkillBonusCapExceededError,
  SkillNotFoundError,
  SkillPoolExceededError,
} from '../character.errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeCreateResult,
  makeMembership,
  makeNotifier,
  makeSkillSummary,
} from '../character.testkit.js';
import { CreateCharacterService } from './create-character.service.js';
import type { CreateCharacterCommand } from './create-character.service.js';

const CLIENT_REQUEST_ID = '33333333-3333-3333-3333-333333333333';

function fixedRng(value: number): Rng {
  return () => value;
}

function baseCommand(
  overrides: Partial<CreateCharacterCommand> = {},
): CreateCharacterCommand {
  return {
    gameId: 'game-1',
    clientRequestId: CLIENT_REQUEST_ID,
    nickname: 'Hero',
    cognition: -5,
    psyche: -5,
    instinct: -5,
    constitution: -5,
    motricity: -5,
    perception: -5,
    personality: 'Erudito',
    posture: 'Abrutalhado',
    socialClass: 'plebeu',
    skills: [],
    ...overrides,
  };
}

describe('CreateCharacterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids creating a character when the player is not a game member', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    const notifier = makeNotifier();
    vi.mocked(membership.isMember).mockResolvedValue(false);

    await expect(
      new CreateCharacterService(
        characters,
        membership,
        fixedRng(1),
        notifier,
      ).execute('player-1', baseCommand()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.create).not.toHaveBeenCalled();
    expect(notifier.notifyRosterChanged).not.toHaveBeenCalled();
  });

  it('keys the creation by player and clientRequestId', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
      makeNotifier(),
    ).execute('player-1', baseCommand());

    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'player-1',
        clientRequestId: CLIENT_REQUEST_ID,
      }),
    );
  });

  it('returns the stored character of a replay without notifying again', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    const notifier = makeNotifier();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    const stored = makeCharacter({ id: 'first-char' });
    vi.mocked(characters.create).mockResolvedValue(
      makeCreateResult({ character: stored, created: false }),
    );

    const result = await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
      notifier,
    ).execute('player-1', baseCommand());

    expect(result).toBe(stored);
    expect(notifier.notifyRosterChanged).not.toHaveBeenCalled();
  });

  it('allows the game master who is not a member to create a character', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'player-1',
    });
    vi.mocked(membership.isMember).mockResolvedValue(false);
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
      makeNotifier(),
    ).execute('player-1', baseCommand());

    expect(characters.create).toHaveBeenCalled();
  });

  it('rejects an attribute spread above the np budget', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);

    await expect(
      new CreateCharacterService(
        characters,
        membership,
        fixedRng(1),
        makeNotifier(),
      ).execute(
        'player-1',
        baseCommand({ cognition: 5, psyche: 5, instinct: 5, motricity: 5 }),
      ),
    ).rejects.toBeInstanceOf(AttributeBudgetExceededError);
  });

  it('rejects -1/0 as attribute values', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);

    await expect(
      new CreateCharacterService(
        characters,
        membership,
        fixedRng(1),
        makeNotifier(),
      ).execute('player-1', baseCommand({ cognition: 0 })),
    ).rejects.toBeInstanceOf(InvalidAttributeError);
  });

  it('rejects an unknown personality/posture pair', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);

    await expect(
      new CreateCharacterService(
        characters,
        membership,
        fixedRng(1),
        makeNotifier(),
      ).execute('player-1', baseCommand({ posture: 'Inexistente' })),
    ).rejects.toBeInstanceOf(InvalidArchetypeError);
  });

  it('derives proficiency levels from personality + posture', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
      makeNotifier(),
    ).execute('player-1', baseCommand());

    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cognitionProficiency: 'especialista',
        psycheProficiency: 'imperito',
        instinctProficiency: 'imperito',
        constitutionProficiency: 'especialista',
        motricityProficiency: 'imperito',
        perceptionProficiency: 'imperito',
      }),
    );
  });

  it('persists maxHp, maxEffort, bExp and a zeroed current effort', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
      makeNotifier(),
    ).execute('player-1', baseCommand({ constitution: 2 }));

    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'player-1',
        np: 1,
        maxHp: 20 + 10,
        currentHp: 20 + 10,
        maxEffort: 20,
        currentEffort: 0,
        bExp: 0,
      }),
    );
  });

  it('derives the hair color from the server d20 roll', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(20),
      makeNotifier(),
    ).execute('player-1', baseCommand());

    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({ hairColor: 'Vermelho Escarlate' }),
    );
  });

  it('derives size and vaalaques from the sheet', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
      makeNotifier(),
    ).execute('player-1', baseCommand({ heightCm: 160, weightKg: 60 }));

    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({ size: 'pequeno', vaalaques: 2 * 40 }),
    );
  });

  it('persists the resolved extreme roll and its size', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);
    vi.mocked(characters.create).mockResolvedValue(makeCreateResult());

    await new CreateCharacterService(
      characters,
      membership,
      fixedRng(1),
      makeNotifier(),
    ).execute(
      'player-1',
      baseCommand({ heightRoll: 'max', weightRoll: 'max' }),
    );

    expect(characters.create).toHaveBeenCalledWith(
      expect.objectContaining({
        heightCm: 251,
        weightKg: 151,
        size: 'enorme',
      }),
    );
  });

  it('rejects an exact height outside the 150..250 band', async () => {
    const characters = makeCharacterRepository();
    const membership = makeMembership();
    vi.mocked(membership.isMember).mockResolvedValue(true);

    await expect(
      new CreateCharacterService(
        characters,
        membership,
        fixedRng(1),
        makeNotifier(),
      ).execute('player-1', baseCommand({ heightCm: 140 })),
    ).rejects.toBeInstanceOf(InvalidHeightError);
  });

  describe('with starting skills', () => {
    const VITALIDADE_ID = '11111111-1111-1111-1111-111111111111';
    const CONDICIONAMENTO_ID = '22222222-2222-2222-2222-222222222222';
    const vitalidade = makeSkillSummary({ id: VITALIDADE_ID });
    const condicionamento = makeSkillSummary({
      id: CONDICIONAMENTO_ID,
      name: 'Condicionamento',
    });

    function setup() {
      const characters = makeCharacterRepository();
      const membership = makeMembership();
      vi.mocked(membership.isMember).mockResolvedValue(true);
      vi.mocked(characters.create).mockResolvedValue(makeCreateResult());
      vi.mocked(characters.findSkillsByIds).mockResolvedValue([
        vitalidade,
        condicionamento,
      ]);
      const service = new CreateCharacterService(
        characters,
        membership,
        fixedRng(1),
        makeNotifier(),
      );

      return { characters, service };
    }

    it('derives max PS and PE from the Vitalidade and Condicionamento bonuses', async () => {
      const { characters, service } = setup();

      await service.execute(
        'player-1',
        baseCommand({
          skills: [
            { skillId: VITALIDADE_ID, proficiencyBonus: 4 },
            { skillId: CONDICIONAMENTO_ID, proficiencyBonus: 3 },
          ],
        }),
      );

      expect(characters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          maxHp: 20 + 6 + 4,
          currentHp: 20 + 6 + 4,
          maxEffort: 23,
        }),
      );
    });

    it('rejects a bonus above the cap before creating', async () => {
      const { characters, service } = setup();
      vi.mocked(characters.findSkillsByIds).mockResolvedValue([vitalidade]);

      await expect(
        service.execute(
          'player-1',
          baseCommand({
            skills: [{ skillId: VITALIDADE_ID, proficiencyBonus: 31 }],
          }),
        ),
      ).rejects.toBeInstanceOf(SkillBonusCapExceededError);
      expect(characters.create).not.toHaveBeenCalled();
    });

    it('rejects points above the attribute pool before creating', async () => {
      const { characters, service } = setup();

      await expect(
        service.execute(
          'player-1',
          baseCommand({
            skills: [
              { skillId: VITALIDADE_ID, proficiencyBonus: 10 },
              { skillId: CONDICIONAMENTO_ID, proficiencyBonus: 10 },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(SkillPoolExceededError);
      expect(characters.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown skill before creating', async () => {
      const { characters, service } = setup();
      vi.mocked(characters.findSkillsByIds).mockResolvedValue([vitalidade]);

      await expect(
        service.execute(
          'player-1',
          baseCommand({
            skills: [
              { skillId: VITALIDADE_ID, proficiencyBonus: 1 },
              { skillId: CONDICIONAMENTO_ID, proficiencyBonus: 1 },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(SkillNotFoundError);
      expect(characters.create).not.toHaveBeenCalled();
    });
  });
});
