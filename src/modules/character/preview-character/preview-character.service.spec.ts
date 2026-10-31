import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveProficiencies, deriveSize } from '../character.derivation.js';
import { startingWealthRange } from '@shared/rules/social-classes.js';
import { InvalidArchetypeError } from '../character.errors.js';
import {
  attributePointsSpent,
  attributeBudget,
} from '../character.attributes.js';
import {
  makeCharacterRepository,
  makeSkillSummary,
} from '../character.testkit.js';
import { bExp, hitDie, maxEffort, maxHp } from '@shared/rules/vitals.js';
import type { PreviewCharacterBody } from '../character.schemas.js';
import { PreviewCharacterService } from './preview-character.service.js';

const ATTRIBUTES = {
  cognition: 1,
  psyche: -3,
  instinct: 2,
  constitution: 3,
  motricity: -5,
  perception: 4,
} as const;

const FULL_INPUT: PreviewCharacterBody = {
  np: 3,
  ...ATTRIBUTES,
  personality: 'Erudito',
  posture: 'Abrutalhado',
  heightCm: 180,
  weightKg: 80,
  socialClass: 'plebeu',
  skills: [{ skillId: 'skill-vit', proficiencyBonus: 4 }],
};

function makeService() {
  const characters = makeCharacterRepository();
  vi.mocked(characters.findSkillsByIds).mockResolvedValue([
    makeSkillSummary({ id: 'skill-vit', name: 'Vitalidade' }),
  ]);

  return { characters, service: new PreviewCharacterService(characters) };
}

describe('PreviewCharacterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the values the shared functions derive for a full input', async () => {
    const { service } = makeService();

    const preview = await service.execute(FULL_INPUT);

    const proficiencies = deriveProficiencies('Erudito', 'Abrutalhado');
    expect(preview.hitDie).toBe(hitDie(3).die);
    expect(preview.maxHp).toBe(maxHp(3, 3, 4));
    expect(preview.maxEffort).toBe(maxEffort(0));
    expect(preview.bExp).toBe(bExp(3));
    expect(preview.proficiencyLevels).toEqual({
      cognition: proficiencies.cognitionProficiency,
      psyche: proficiencies.psycheProficiency,
      instinct: proficiencies.instinctProficiency,
      constitution: proficiencies.constitutionProficiency,
      motricity: proficiencies.motricityProficiency,
      perception: proficiencies.perceptionProficiency,
    });
    expect(preview.attributePoints).toEqual({
      budget: attributeBudget(3),
      spent: attributePointsSpent(ATTRIBUTES),
      remaining: attributeBudget(3) - attributePointsSpent(ATTRIBUTES),
    });
    expect(preview.size?.category).toBe(deriveSize(180, 80));
    expect(preview.startingWealth).toEqual(startingWealthRange('plebeu'));
  });

  it('computes skill budget per attribute from level and NP', async () => {
    const { service } = makeService();

    const preview = await service.execute(FULL_INPUT);

    expect(preview.skillBudget).toEqual({
      cognition: 28,
      psyche: 4,
      instinct: 4,
      constitution: 28,
      motricity: 4,
      perception: 4,
    });
  });

  it('returns null for everything that lacks inputs on an empty body', async () => {
    const { service, characters } = makeService();

    const preview = await service.execute({ np: 1 });

    expect(preview).toEqual({
      hitDie: null,
      maxHp: null,
      maxEffort: 20,
      bExp: 0,
      proficiencyLevels: null,
      skillBudget: null,
      attributePoints: { budget: 20, spent: 0, remaining: 20 },
      size: null,
      heightFactor: null,
      weightFactor: null,
      startingWealth: null,
    });
    expect(characters.findSkillsByIds).not.toHaveBeenCalled();
  });

  it('adds the Vitalidade bonus to max HP and Condicionamento to max effort', async () => {
    const { characters, service } = makeService();
    vi.mocked(characters.findSkillsByIds).mockResolvedValue([
      makeSkillSummary({ id: 'a', name: 'Vitalidade' }),
      makeSkillSummary({ id: 'b', name: 'Condicionamento' }),
    ]);

    const preview = await service.execute({
      np: 1,
      constitution: 1,
      skills: [
        { skillId: 'a', proficiencyBonus: 5 },
        { skillId: 'b', proficiencyBonus: 7 },
      ],
    });

    expect(preview.maxHp).toBe(maxHp(1, 1, 5));
    expect(preview.maxEffort).toBe(maxEffort(7));
  });

  it('rejects an unknown archetype pair', async () => {
    const { service } = makeService();

    await expect(
      service.execute({ np: 1, personality: 'x', posture: 'y' }),
    ).rejects.toBeInstanceOf(InvalidArchetypeError);
  });

  it.each([
    [150, 50, 1, 'pequeno', { category: 'medio', factorNeeded: 2 }],
    [170, 70, 1, 'pequeno', { category: 'medio', factorNeeded: 2 }],
    [171, 70, 1.5, 'pequeno', { category: 'medio', factorNeeded: 2 }],
    [171, 71, 2, 'medio', { category: 'grande', factorNeeded: 3.5 }],
    [190, 90, 2, 'medio', { category: 'grande', factorNeeded: 3.5 }],
    [191, 90, 2.5, 'medio', { category: 'grande', factorNeeded: 3.5 }],
    [191, 91, 3, 'medio', { category: 'grande', factorNeeded: 3.5 }],
    [211, 91, 3.5, 'grande', { category: 'enorme', factorNeeded: 5 }],
    [250, 150, 4, 'grande', { category: 'enorme', factorNeeded: 5 }],
  ])(
    'height %i / weight %i gives factor %f in %s',
    async (heightCm, weightKg, factor, category, next) => {
      const { service } = makeService();

      const preview = await service.execute({ np: 1, heightCm, weightKg });

      expect(preview.size).toEqual({ factor, category, next });
    },
  );

  it('has no next category from enorme', async () => {
    const { service } = makeService();

    const preview = await service.execute({
      np: 1,
      heightCm: 251,
      weightKg: 151,
    });

    expect(preview.size).toEqual({ factor: 5, category: 'enorme', next: null });
  });

  it('resolves size from the fixed factor of a rolled height band', async () => {
    const { service } = makeService();

    const preview = await service.execute({
      np: 1,
      heightRoll: 'min',
      weightKg: 70,
    });

    expect(preview.size).toEqual({
      factor: 0.5,
      category: 'pequeno',
      next: { category: 'medio', factorNeeded: 2 },
    });
  });

  it('resolves size from the fixed factor of a rolled weight band', async () => {
    const { service } = makeService();

    const preview = await service.execute({
      np: 1,
      heightCm: 180,
      weightRoll: 'max',
    });

    expect(preview.size).toEqual({
      factor: 3.5,
      category: 'grande',
      next: { category: 'enorme', factorNeeded: 5 },
    });
  });

  it('has no next category when both dimensions roll max', async () => {
    const { service } = makeService();

    const preview = await service.execute({
      np: 1,
      heightRoll: 'max',
      weightRoll: 'max',
    });

    expect(preview.size).toEqual({ factor: 5, category: 'enorme', next: null });
  });

  it('returns miudo when both dimensions roll min', async () => {
    const { service } = makeService();

    const preview = await service.execute({
      np: 1,
      heightRoll: 'min',
      weightRoll: 'min',
    });

    expect(preview.size?.category).toBe('miudo');
  });

  it('returns the height factor alone when weight is missing', async () => {
    const { service } = makeService();

    const preview = await service.execute({ np: 1, heightCm: 180 });

    expect(preview.heightFactor).toBe(2);
    expect(preview.weightFactor).toBeNull();
    expect(preview.size).toBeNull();
  });

  it('returns the fixed factor of a rolled max height band', async () => {
    const { service } = makeService();

    const preview = await service.execute({ np: 1, heightRoll: 'max' });

    expect(preview.heightFactor).toBe(5);
    expect(preview.weightFactor).toBeNull();
  });

  it('returns null size when only one of height and weight is given', async () => {
    const { service } = makeService();

    const preview = await service.execute({ np: 1, heightCm: 180 });

    expect(preview.size).toBeNull();
  });
});
