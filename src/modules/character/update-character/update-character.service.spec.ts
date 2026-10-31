import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { Rng } from '../character.derivation.js';
import type {
  Character,
  CharacterSkillDetail,
  SheetChanges,
} from '../character.entity.js';
import {
  ArchetypeMasterOnlyError,
  AttributeBudgetExceededError,
  CharacterVersionConflictError,
  InvalidAttributeError,
  InvalidHeightError,
  InvalidWeightError,
  NpMasterOnlyError,
  NpReductionBlockedError,
  SheetPointsMasterOnlyError,
} from '../character.errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeMembership,
  makeNotifier,
  makeSkillDetail,
  stubUpdateSheet,
} from '../character.testkit.js';
import {
  type UpdateCharacterCommand,
  UpdateCharacterService,
} from './update-character.service.js';

function fixedRng(value: number): Rng {
  return () => value;
}

interface Scenario {
  character?: Character;
  skills?: CharacterSkillDetail[];
  requester?: string;
  input?: Partial<UpdateCharacterCommand>;
}

async function decide(scenario: Scenario): Promise<SheetChanges> {
  const character = scenario.character ?? makeCharacter();
  const characters = makeCharacterRepository();
  vi.mocked(characters.findById).mockResolvedValue(character);
  const stub = stubUpdateSheet(characters, character, scenario.skills);

  await new UpdateCharacterService(
    characters,
    makeMembership(),
    fixedRng(1),
    makeNotifier(),
  ).execute('char-1', scenario.requester ?? 'player-1', {
    version: 0,
    ...scenario.input,
  });

  const changes = stub.changes();
  if (!changes) throw new Error('decision was not made');

  return changes;
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
      ).execute('char-1', 'intruder', { version: 0, nickname: 'X' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.updateSheet).not.toHaveBeenCalled();
    expect(notifier.notifyRosterChanged).not.toHaveBeenCalled();
  });

  it('sends the request version to the repository', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    stubUpdateSheet(characters);

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'player-1', { version: 7, nickname: 'X' });

    expect(characters.updateSheet).toHaveBeenCalledWith({
      id: 'char-1',
      expectedVersion: 7,
      decide: expect.any(Function),
    });
  });

  it('propagates a version conflict without notifying the roster', async () => {
    const characters = makeCharacterRepository();
    const notifier = makeNotifier();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.updateSheet).mockRejectedValue(
      new CharacterVersionConflictError(),
    );

    await expect(
      new UpdateCharacterService(
        characters,
        makeMembership(),
        fixedRng(1),
        notifier,
      ).execute('char-1', 'player-1', { version: 0, nickname: 'X' }),
    ).rejects.toBeInstanceOf(CharacterVersionConflictError);
    expect(notifier.notifyRosterChanged).not.toHaveBeenCalled();
  });

  it('rejects a sheet whose attributes exceed the np budget', async () => {
    await expect(
      decide({
        requester: 'master-1',
        input: { cognition: 5, psyche: 5, instinct: 5, motricity: 5 },
      }),
    ).rejects.toBeInstanceOf(AttributeBudgetExceededError);
  });

  it('rejects -1/0 as attribute values', async () => {
    await expect(
      decide({ requester: 'master-1', input: { perception: 0 } }),
    ).rejects.toBeInstanceOf(InvalidAttributeError);
  });

  it('recomputes maxHp, maxEffort and bExp on a sheet change', async () => {
    const changes = await decide({
      requester: 'master-1',
      input: { np: 2, constitution: -2 },
    });

    expect(changes).toMatchObject({
      np: 2,
      constitution: -2,
      maxHp: 20 + 2 * 8,
      maxEffort: 20,
      bExp: 1,
    });
  });

  it('adds the Vitalidade/Condicionamento skill bonuses to the vitals', async () => {
    const changes = await decide({
      requester: 'master-1',
      character: makeCharacter({ constitutionProficiency: 'especialista' }),
      skills: [
        makeSkillDetail({ skillName: 'Vitalidade', proficiencyBonus: 6 }),
        makeSkillDetail({
          skillId: '22222222-2222-2222-2222-222222222222',
          skillName: 'Condicionamento',
          proficiencyBonus: 4,
        }),
      ],
      input: { np: 1 },
    });

    expect(changes).toMatchObject({ maxHp: 20 + 1 * 6 + 6, maxEffort: 24 });
  });

  it('never carries current vitals, which the repository clamps in SQL', async () => {
    const changes = await decide({
      requester: 'master-1',
      character: makeCharacter({ currentHp: 500, currentEffort: 500 }),
      input: { np: 1 },
    });

    expect(changes).not.toHaveProperty('currentHp');
    expect(changes).not.toHaveProperty('currentEffort');
    expect(changes).toMatchObject({ maxHp: 26, maxEffort: 20 });
  });

  it('re-derives proficiency levels when the archetype changes', async () => {
    const changes = await decide({
      requester: 'master-1',
      input: { personality: 'Erudito', posture: 'Abrutalhado' },
    });

    expect(changes).toMatchObject({
      cognitionProficiency: 'especialista',
      constitutionProficiency: 'especialista',
      psycheProficiency: 'imperito',
    });
  });

  it('keeps vaalaques when the social class is unchanged', async () => {
    const changes = await decide({
      character: makeCharacter({ socialClass: 'plebeu', vaalaques: 80 }),
      input: { nickname: 'Renamed' },
    });

    expect(changes.vaalaques).toBe(80);
  });

  it('recomputes vaalaques when the social class changes', async () => {
    const changes = await decide({
      character: makeCharacter({ socialClass: 'plebeu', vaalaques: 80 }),
      input: { socialClass: 'opulento' },
    });

    expect(changes).toMatchObject({
      socialClass: 'opulento',
      vaalaques: 2 * 720,
    });
  });

  it('persists the resolved roll and derives the size from it', async () => {
    const changes = await decide({
      character: makeCharacter({
        heightCm: 160,
        weightKg: 60,
        size: 'pequeno',
      }),
      input: { heightRoll: 'max' },
    });

    expect(changes).toMatchObject({
      heightCm: 251,
      weightKg: 60,
      size: 'medio',
    });
  });

  it('keeps the current appearance when nothing is informed', async () => {
    const changes = await decide({
      character: makeCharacter({
        heightCm: 160,
        weightKg: 60,
        size: 'pequeno',
      }),
      input: { nickname: 'Renamed' },
    });

    expect(changes).toMatchObject({
      heightCm: 160,
      weightKg: 60,
      size: 'pequeno',
    });
  });

  it('rejects an ambiguous height update', async () => {
    await expect(
      decide({ input: { heightCm: 160, heightRoll: 'min' } }),
    ).rejects.toBeInstanceOf(InvalidHeightError);
  });

  it('rejects an exact weight outside the 50..150 band', async () => {
    await expect(decide({ input: { weightKg: 151 } })).rejects.toBeInstanceOf(
      InvalidWeightError,
    );
  });

  it.each([
    'cognition',
    'psyche',
    'instinct',
    'constitution',
    'motricity',
    'perception',
  ] as const)('forbids a player from sending %s', async (attribute) => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());

    const execution = new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'player-1', { version: 0, [attribute]: -4 });

    await expect(execution).rejects.toBeInstanceOf(SheetPointsMasterOnlyError);
    await expect(execution).rejects.toThrow(
      'Use Evoluir personagem para distribuir pontos.',
    );
    expect(characters.updateSheet).not.toHaveBeenCalled();
  });

  it.each(['personality', 'posture'] as const)(
    'forbids a player from sending %s',
    async (field) => {
      const characters = makeCharacterRepository();
      vi.mocked(characters.findById).mockResolvedValue(makeCharacter());

      const execution = new UpdateCharacterService(
        characters,
        makeMembership(),
        fixedRng(1),
        makeNotifier(),
      ).execute('char-1', 'player-1', { version: 0, [field]: 'Altruísta' });

      await expect(execution).rejects.toBeInstanceOf(ArchetypeMasterOnlyError);
      await expect(execution).rejects.toThrow(
        'Só o Mestre muda personalidade e postura.',
      );
      expect(characters.updateSheet).not.toHaveBeenCalled();
    },
  );

  it('forbids the owner from changing np', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());

    await expect(
      new UpdateCharacterService(
        characters,
        makeMembership(),
        fixedRng(1),
        makeNotifier(),
      ).execute('char-1', 'player-1', { version: 0, np: 2 }),
    ).rejects.toBeInstanceOf(NpMasterOnlyError);
    expect(characters.updateSheet).not.toHaveBeenCalled();
  });

  it('allows the master to change np and recomputes bExp and maxHp', async () => {
    const changes = await decide({
      requester: 'master-1',
      input: { np: 2 },
    });

    expect(changes).toMatchObject({ np: 2, bExp: 1, maxHp: 20 + 2 * 6 });
  });

  it('blocks an np reduction below the spent skill pool and names it', async () => {
    const error = await decide({
      requester: 'master-1',
      character: makeCharacter({ np: 5 }),
      skills: [makeSkillDetail({ proficiencyBonus: 6 })],
      input: { np: 3 },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NpReductionBlockedError);
    expect((error as Error).message).toBe(
      'Não dá para descer: Perícias de Constituição usam 6 de 4.',
    );
  });

  it('blocks an np reduction below the spent attribute points and names it', async () => {
    const error = await decide({
      requester: 'master-1',
      character: makeCharacter({
        np: 5,
        cognition: 5,
        psyche: 5,
        instinct: 5,
        motricity: 5,
      }),
      input: { np: 1 },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NpReductionBlockedError);
    expect((error as Error).message).toBe(
      'Não dá para descer: Pontos de Atributo usam 32 de 20.',
    );
  });

  describe('np change notification', () => {
    it('publishes nothing on a version conflict', async () => {
      const notifier = makeNotifier();
      const characters = makeCharacterRepository();
      vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
      vi.mocked(characters.updateSheet).mockRejectedValue(
        new CharacterVersionConflictError(),
      );

      await expect(
        new UpdateCharacterService(
          characters,
          makeMembership(),
          fixedRng(1),
          notifier,
        ).execute('char-1', 'master-1', { version: 0, np: 4 }),
      ).rejects.toBeInstanceOf(CharacterVersionConflictError);
      expect(notifier.notifyNpChanged).not.toHaveBeenCalled();
    });
  });

  it('decides from the character locked by the repository, not the stale read', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ constitution: -5 }),
    );
    const locked = makeCharacter({ np: 3, constitution: -2 });
    const stub = stubUpdateSheet(characters, locked);

    await new UpdateCharacterService(
      characters,
      makeMembership(),
      fixedRng(1),
      makeNotifier(),
    ).execute('char-1', 'player-1', { version: 0, nickname: 'X' });

    expect(stub.changes()).toMatchObject({ np: 3, constitution: -2 });
  });

  it('keeps legacy free-text afflictions when the patch omits them', async () => {
    const changes = await decide({
      character: makeCharacter({ afflictions: ['medo de altura'] }),
      input: { nickname: 'Renamed' },
    });

    expect(changes).not.toHaveProperty('afflictions');
  });
});
