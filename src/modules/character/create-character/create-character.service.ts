import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { GameSessionNotifier } from '@shared/game-session/game-session-notifier.contract.js';
import { hairColorForRoll } from '@shared/rules/hair-color.js';
import { resolveHeight, resolveWeight } from '../character.appearance.js';
import { assertAttributeBudget } from '../character.attributes.js';
import { requireMembership } from '../character.authorization.js';
import {
  deriveProficiencies,
  deriveSize,
  deriveVaalaques,
  type Rng,
} from '../character.derivation.js';
import type { Character, CharacterSheetInput } from '../character.entity.js';
import type { CharacterRepository } from '../character.repository.js';
import { bExp, maxEffort, maxHp } from '../character.stats.js';

export type CreateCharacterCommand = CharacterSheetInput & { gameId: string };

const STARTING_CURRENT_EFFORT = 0;
const STARTING_PROFICIENCY = 0;

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
    assertAttributeBudget(input.np, input);

    const proficiencies = deriveProficiencies(input.personality, input.posture);
    // No skills exist at creation, so Vitalidade/Condicionamento contribute 0.
    const hp = maxHp(input.np, input.constitution, STARTING_PROFICIENCY);
    const effort = maxEffort(STARTING_PROFICIENCY);
    const heightCm = resolveHeight(input, this.rng);
    const weightKg = resolveWeight(input, this.rng);
    const hairColor = hairColorForRoll(this.rng(1, 20));

    const character = await this.characters.create({
      ...input,
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
      bExp: bExp(input.np),
    });

    await this.notifier.notifyRosterChanged(character.gameId);

    return character;
  }
}
