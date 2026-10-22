import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { GameSessionNotifier } from '@shared/game-session/game-session-notifier.contract.js';
import { hairColorForRoll } from '@shared/rules/hair-color.js';
import { resolveHeight, resolveWeight } from '../character.appearance.js';
import { assertAttributeBudget } from '../character.attributes.js';
import { requireMembership } from '../character.authorization.js';
import {
  CONDICIONAMENTO,
  deriveProficiencies,
  deriveSize,
  deriveVaalaques,
  proficiencyBonus,
  type Rng,
  VITALIDADE,
} from '../character.derivation.js';
import type {
  Character,
  CharacterSheetInput,
  UpsertSkillInput,
} from '../character.entity.js';
import { SkillNotFoundError } from '../character.errors.js';
import type { CharacterRepository } from '../character.repository.js';
import { bExp, maxEffort, maxHp } from '../character.stats.js';
import {
  assertSkillBonusCaps,
  assertSkillPools,
  type SkillAllocationDetail,
} from '../skills/skill-allocation.js';

export type CreateCharacterCommand = Omit<CharacterSheetInput, 'np'> & {
  gameId: string;
  skills: UpsertSkillInput[];
};

const STARTING_NP = 1;
const STARTING_CURRENT_EFFORT = 0;

export class CreateCharacterService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly membership: GameAccess,
    private readonly rng: Rng,
    private readonly notifier: GameSessionNotifier,
  ) {}

  async execute(
    playerId: string,
    input: CreateCharacterCommand,
  ): Promise<Character> {
    await requireMembership(this.membership, input.gameId, playerId);
    assertAttributeBudget(STARTING_NP, input);

    const proficiencies = deriveProficiencies(input.personality, input.posture);
    const allocations = await this.resolveAllocations(input.skills);
    assertSkillBonusCaps(proficiencies, allocations);
    assertSkillPools(proficiencies, STARTING_NP, allocations);

    const hp = maxHp(
      STARTING_NP,
      input.constitution,
      proficiencyBonus(allocations, VITALIDADE),
    );
    const effort = maxEffort(proficiencyBonus(allocations, CONDICIONAMENTO));
    const heightCm = resolveHeight(input, this.rng);
    const weightKg = resolveWeight(input, this.rng);
    const hairColor = hairColorForRoll(this.rng(1, 20));

    const character = await this.characters.create({
      ...input,
      np: STARTING_NP,
      playerId,
      ...proficiencies,
      hairColor,
      heightCm: heightCm ?? undefined,
      weightKg: weightKg ?? undefined,
      size: deriveSize(heightCm, weightKg),
      vaalaques: deriveVaalaques(input.socialClass, this.rng),
      maxHp: hp,
      currentHp: hp,
      maxEffort: effort,
      currentEffort: STARTING_CURRENT_EFFORT,
      bExp: bExp(STARTING_NP),
    });

    await this.notifier.notifyRosterChanged(character.gameId);

    return character;
  }

  private async resolveAllocations(
    requested: readonly UpsertSkillInput[],
  ): Promise<SkillAllocationDetail[]> {
    if (requested.length === 0) return [];

    const found = await this.characters.findSkillsByIds(
      requested.map((entry) => entry.skillId),
    );
    if (found.length !== requested.length) throw new SkillNotFoundError();

    return requested.map((entry) => {
      const skill = found.find((candidate) => candidate.id === entry.skillId);
      if (!skill) throw new SkillNotFoundError();

      return {
        skillId: skill.id,
        skillName: skill.name,
        attribute: skill.attribute,
        proficiencyBonus: entry.proficiencyBonus,
      };
    });
  }
}
