import { requireOwnedCharacter } from '../character.authorization.js';
import type {
  Character,
  UpdateVitalsInput,
} from '../character.entity.js';
import type { CharacterRepository } from '../character.repository.js';

function clamp(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;

  return value;
}

export class UpdateVitalsService {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(
    id: string,
    requesterId: string,
    input: UpdateVitalsInput,
  ): Promise<Character> {
    const character = await requireOwnedCharacter(
      this.characters,
      id,
      requesterId,
    );

    const currentHp =
      input.currentHp === undefined
        ? character.currentHp
        : clamp(input.currentHp, character.maxHp);
    const currentEffort =
      input.currentEffort === undefined
        ? character.currentEffort
        : clamp(input.currentEffort, character.maxEffort);

    return this.characters.save(id, { currentHp, currentEffort });
  }
}
