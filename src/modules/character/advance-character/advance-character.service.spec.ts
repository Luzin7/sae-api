import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import type {
  Character,
  CharacterSkillDetail,
  SheetChanges,
} from '../character.entity.js';
import {
  AttributeBudgetExceededError,
  CharacterVersionConflictError,
  EmptyAdvancementError,
  SkillBonusCapExceededError,
  SkillPoolExceededError,
  SpentPointsLockedError,
} from '../character.errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeNotifier,
  makeSkillDetail,
  makeSkillSummary,
  stubUpdateSheet,
} from '../character.testkit.js';
import {
  type AdvanceCharacterCommand,
  AdvanceCharacterService,
} from './advance-character.service.js';

const VITALIDADE_ID = '11111111-1111-1111-1111-111111111111';
const CONDICIONAMENTO_ID = '22222222-2222-2222-2222-222222222222';
const ATLETISMO_ID = '33333333-3333-3333-3333-333333333333';

const CATALOG = [
  makeSkillSummary(),
  makeSkillSummary({
    id: CONDICIONAMENTO_ID,
    name: 'Condicionamento',
    attribute: 'constitution',
  }),
  makeSkillSummary({
    id: ATLETISMO_ID,
    name: 'Atletismo',
    attribute: 'motricity',
  }),
];

interface Scenario {
  character?: Character;
  skills?: CharacterSkillDetail[];
  requester?: string;
  input?: Partial<AdvanceCharacterCommand>;
}

function build(scenario: Scenario) {
  const character = scenario.character ?? makeCharacter({ np: 2 });
  const characters = makeCharacterRepository();
  const notifier = makeNotifier();
  vi.mocked(characters.findById).mockResolvedValue(character);
  vi.mocked(characters.findSkillsByIds).mockImplementation(async (ids) =>
    CATALOG.filter((skill) => ids.includes(skill.id)),
  );
  const stub = stubUpdateSheet(characters, character, scenario.skills);
  const service = new AdvanceCharacterService(characters, notifier);
  const run = () =>
    service.execute('char-1', scenario.requester ?? 'player-1', {
      version: 0,
      attributes: {},
      skills: [],
      ...scenario.input,
    });

  return { characters, notifier, stub, run };
}

async function decide(scenario: Scenario): Promise<SheetChanges> {
  const { stub, run } = build(scenario);
  await run();
  const changes = stub.changes();
  if (!changes) throw new Error('decision was not made');

  return changes;
}

describe('AdvanceCharacterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids the Mestre who does not own the character', async () => {
    const { characters, notifier, run } = build({
      requester: 'master-1',
      input: { attributes: { cognition: -4 } },
    });

    await expect(run()).rejects.toBeInstanceOf(ForbiddenError);
    expect(characters.updateSheet).not.toHaveBeenCalled();
    expect(notifier.notifyCharacterAdvanced).not.toHaveBeenCalled();
  });

  it('rejects an attribute below its saved value', async () => {
    const character = makeCharacter({ np: 2, cognition: 2 });

    await expect(
      decide({ character, input: { attributes: { cognition: 1 } } }),
    ).rejects.toBeInstanceOf(SpentPointsLockedError);
  });

  it('rejects a skill below its saved value', async () => {
    const skills = [
      makeSkillDetail({
        skillId: ATLETISMO_ID,
        skillName: 'Atletismo',
        attribute: 'motricity',
        proficiencyBonus: 2,
      }),
    ];

    await expect(
      decide({
        skills,
        input: { skills: [{ skillId: ATLETISMO_ID, proficiencyBonus: 1 }] },
      }),
    ).rejects.toBeInstanceOf(SpentPointsLockedError);
  });

  it('rejects a request that increases nothing', async () => {
    const character = makeCharacter({ np: 2, cognition: 2 });

    await expect(
      decide({ character, input: { attributes: { cognition: 2 } } }),
    ).rejects.toBeInstanceOf(EmptyAdvancementError);
    await expect(decide({})).rejects.toBeInstanceOf(EmptyAdvancementError);
  });

  it('rejects an attribute raise over the NP budget', async () => {
    const character = makeCharacter({
      np: 1,
      cognition: 5,
      psyche: 4,
      instinct: 2,
      constitution: -5,
      motricity: -5,
      perception: -5,
    });

    await expect(
      decide({ character, input: { attributes: { instinct: 3 } } }),
    ).rejects.toBeInstanceOf(AttributeBudgetExceededError);
  });

  it('rejects a skill raise over the attribute pool', async () => {
    await expect(
      decide({
        input: { skills: [{ skillId: ATLETISMO_ID, proficiencyBonus: 3 }] },
      }),
    ).rejects.toBeInstanceOf(SkillPoolExceededError);
  });

  it('rejects a skill raise over the per-skill cap', async () => {
    const character = makeCharacter({
      np: 10,
      motricityProficiency: 'imperito',
    });

    await expect(
      decide({
        character,
        input: { skills: [{ skillId: ATLETISMO_ID, proficiencyBonus: 21 }] },
      }),
    ).rejects.toBeInstanceOf(SkillBonusCapExceededError);
  });

  it('recomputes max PS from CON +2 to +3 and leaves current PS to the repository', async () => {
    const character = makeCharacter({
      np: 2,
      constitution: 2,
      maxHp: 40,
      currentHp: 10,
    });

    const changes = await decide({
      character,
      input: { attributes: { constitution: 3 } },
    });

    expect(changes.constitution).toBe(3);
    expect(changes.maxHp).toBe(20 + 2 * 12);
    expect(changes).not.toHaveProperty('currentHp');
  });

  it('raises the limits with Vitalidade and Condicionamento', async () => {
    const changes = await decide({
      character: makeCharacter({
        np: 2,
        constitution: -5,
        constitutionProficiency: 'competente',
      }),
      input: {
        skills: [
          { skillId: VITALIDADE_ID, proficiencyBonus: 2 },
          { skillId: CONDICIONAMENTO_ID, proficiencyBonus: 1 },
        ],
      },
    });

    expect(changes.maxHp).toBe(20 + 2 * 6 + 2);
    expect(changes.maxEffort).toBe(21);
    expect(changes.skills).toEqual([
      { skillId: VITALIDADE_ID, proficiencyBonus: 2 },
      { skillId: CONDICIONAMENTO_ID, proficiencyBonus: 1 },
    ]);
  });

  it('keeps NP and bExp and writes only the increased skills', async () => {
    const character = makeCharacter({
      np: 2,
      constitutionProficiency: 'competente',
    });
    const skills = [makeSkillDetail({ proficiencyBonus: 2 })];

    const changes = await decide({
      character,
      skills,
      input: {
        attributes: { cognition: -4 },
        skills: [
          { skillId: VITALIDADE_ID, proficiencyBonus: 2 },
          { skillId: CONDICIONAMENTO_ID, proficiencyBonus: 1 },
        ],
      },
    });

    expect(changes).not.toHaveProperty('np');
    expect(changes).not.toHaveProperty('bExp');
    expect(changes.skills).toEqual([
      { skillId: CONDICIONAMENTO_ID, proficiencyBonus: 1 },
    ]);
  });

  it('forwards the version and decides from the locked row', async () => {
    const { characters, run } = build({
      input: { version: 7, attributes: { cognition: -4 } },
    });
    vi.mocked(characters.updateSheet).mockResolvedValue(
      makeCharacter({ version: 8 }),
    );

    await run();

    expect(characters.updateSheet).toHaveBeenCalledWith({
      id: 'char-1',
      expectedVersion: 7,
      decide: expect.any(Function),
    });
  });

  it('notifies only after the write succeeds', async () => {
    const { characters, notifier, run } = build({
      input: { attributes: { cognition: -4 } },
    });
    vi.mocked(characters.updateSheet).mockRejectedValue(
      new CharacterVersionConflictError(),
    );

    await expect(run()).rejects.toBeInstanceOf(CharacterVersionConflictError);
    expect(notifier.notifyCharacterAdvanced).not.toHaveBeenCalled();
  });
});
