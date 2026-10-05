import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors/http-errors.js';
import {
  makeCharacter,
  makeCharacterRepository,
  makeSkill,
  makeSkillDetail,
  makeSkillSummary,
} from '../../character.testkit.js';
import { SkillPoolExceededError } from '../../character.errors.js';
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

    expect(characters.upsertSkill).toHaveBeenCalledWith('char-1', SKILL_ID, 3);
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
});
