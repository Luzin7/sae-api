import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { GameSessionNotifier } from '@shared/game-session/game-session-notifier.contract.js';
import { requireEditableCharacter } from '../character.authorization.js';
import type { Character, UpdateVitalsInput } from '../character.entity.js';
import type { CharacterRepository } from '../character.repository.js';

function clamp(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;

  return value;
}

export class UpdateVitalsService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly access: GameAccess,
    private readonly notifier: GameSessionNotifier,
  ) {}

  async execute(
    id: string,
    requesterId: string,
    input: UpdateVitalsInput,
  ): Promise<Character> {
    const { character } = await requireEditableCharacter(
      this.characters,
      this.access,
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

    const updated = await this.characters.save(id, {
      currentHp,
      currentEffort,
    });

    if (input.currentHp !== undefined) {
      await this.notifier.notifyHpChanged(updated.gameId, {
        characterId: updated.id,
        oldHp: character.currentHp,
        newHp: updated.currentHp,
      });
    }

    return updated;
  }
}
