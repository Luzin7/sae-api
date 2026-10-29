import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeSkill,
  makeSkillDetail,
  makeSkillSummary,
} from '../../character.testkit.js';
import {
  SkillBonusCapExceededError,
  SkillPoolExceededError,
} from '../../character.errors.js';
import { UpsertSkillService } from './upsert-skill.service.js';

const SKILL_ID = '11111111-1111-1111-1111-111111111111';

describe('UpsertSkillService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids changing skills of a character owned by another player', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ playerId: 'owner' }),
    );

    await expect(
      new UpsertSkillService(characters).execute('char-1', 'intruder', {
        skillId: SKILL_ID,
        proficiencyBonus: 3,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('upserts the skill within the attribute pool', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ constitutionProficiency: 'especialista' }),
    );
    vi.mocked(characters.findSkillById).mockResolvedValue(makeSkillSummary());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.upsertSkill).mockResolvedValue(makeSkill());

    const result = await new UpsertSkillService(characters).execute(
      'char-1',
      'player-1',
      { skillId: SKILL_ID, proficiencyBonus: 3 },
    );

    expect(characters.upsertSkill).toHaveBeenCalledWith({
      characterId: 'char-1',
      skillId: SKILL_ID,
      proficiencyBonus: 3,
      deriveLimits: expect.any(Function),
    });
    expect(result.proficiencyBonus).toBe(3);
  });

  it('rejects a bonus that exceeds the attribute pool', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
    vi.mocked(characters.findSkillById).mockResolvedValue(makeSkillSummary());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);

    await expect(
      new UpsertSkillService(characters).execute('char-1', 'player-1', {
        skillId: SKILL_ID,
        proficiencyBonus: 3,
      }),
    ).rejects.toBeInstanceOf(SkillPoolExceededError);
    expect(characters.upsertSkill).not.toHaveBeenCalled();
  });

  it('sums the other skills of the same attribute against the pool', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ constitutionProficiency: 'especialista' }),
    );
    vi.mocked(characters.findSkillById).mockResolvedValue(
      makeSkillSummary({
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Fortitude',
        attribute: 'constitution',
      }),
    );
    vi.mocked(characters.findSkillDetails).mockResolvedValue([
      makeSkillDetail({ skillId: SKILL_ID, proficiencyBonus: 12 }),
    ]);

    // Especialista pool = 14; 12 already spent + 3 > 14.
    await expect(
      new UpsertSkillService(characters).execute('char-1', 'player-1', {
        skillId: '22222222-2222-2222-2222-222222222222',
        proficiencyBonus: 3,
      }),
    ).rejects.toBeInstanceOf(SkillPoolExceededError);
  });

  it('rejects +21 for a non-Especialista attribute', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ np: 20, constitutionProficiency: 'versado' }),
    );
    vi.mocked(characters.findSkillById).mockResolvedValue(makeSkillSummary());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);

    await expect(
      new UpsertSkillService(characters).execute('char-1', 'player-1', {
        skillId: SKILL_ID,
        proficiencyBonus: 21,
      }),
    ).rejects.toBeInstanceOf(SkillBonusCapExceededError);
    expect(characters.upsertSkill).not.toHaveBeenCalled();
  });

  it('allows +30 for an Especialista attribute', async () => {
    const characters = makeCharacterRepository();
    vi.mocked(characters.findById).mockResolvedValue(
      makeCharacter({ np: 20, constitutionProficiency: 'especialista' }),
    );
    vi.mocked(characters.findSkillById).mockResolvedValue(makeSkillSummary());
    vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
    vi.mocked(characters.upsertSkill).mockResolvedValue(
      makeSkill({ proficiencyBonus: 30 }),
    );

    await new UpsertSkillService(characters).execute('char-1', 'player-1', {
      skillId: SKILL_ID,
      proficiencyBonus: 30,
    });

    expect(characters.upsertSkill).toHaveBeenCalledWith(
      expect.objectContaining({ proficiencyBonus: 30 }),
    );
  });

  describe('derived limits', () => {
    const CONDICIONAMENTO_ID = '33333333-3333-3333-3333-333333333333';

    async function derive(
      skillName: string,
      attribute: 'constitution' | 'instinct',
    ) {
      const characters = makeCharacterRepository();
      const current = makeCharacter({
        np: 2,
        constitution: 1,
        constitutionProficiency: 'especialista',
        instinctProficiency: 'especialista',
      });
      vi.mocked(characters.findById).mockResolvedValue(current);
      vi.mocked(characters.findSkillById).mockResolvedValue(
        makeSkillSummary({
          id: CONDICIONAMENTO_ID,
          name: skillName,
          attribute,
        }),
      );
      vi.mocked(characters.findSkillDetails).mockResolvedValue([]);
      vi.mocked(characters.upsertSkill).mockResolvedValue(makeSkill());

      await new UpsertSkillService(characters).execute('char-1', 'player-1', {
        skillId: CONDICIONAMENTO_ID,
        proficiencyBonus: 7,
      });
      const [command] = vi.mocked(characters.upsertSkill).mock.calls[0]!;

      return command.deriveLimits(current, [
        makeSkillDetail({
          skillName,
          attribute,
          skillId: CONDICIONAMENTO_ID,
          proficiencyBonus: 7,
        }),
      ]);
    }

    it('Condicionamento +7 raises maxEffort to 27', async () => {
      await expect(derive('Condicionamento', 'constitution')).resolves.toEqual({
        maxHp: 20 + 2 * 10,
        maxEffort: 27,
      });
    });

    it('Vitalidade +7 raises maxHp by 7 and keeps maxEffort at 20', async () => {
      await expect(derive('Vitalidade', 'constitution')).resolves.toEqual({
        maxHp: 20 + 2 * 10 + 7,
        maxEffort: 20,
      });
    });

    it('leaves the limits alone for any other skill', async () => {
      await expect(derive('Atletismo', 'constitution')).resolves.toBeNull();
    });
  });
});
