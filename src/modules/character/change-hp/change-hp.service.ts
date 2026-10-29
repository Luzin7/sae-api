import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { GameSessionNotifier } from '@shared/game-session/game-session-notifier.contract.js';
import { requireEditableCharacter } from '../character.authorization.js';
import type { Character } from '../character.entity.js';
import type { CharacterRepository } from '../character.repository.js';

export class ChangeHpService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly access: GameAccess,
    private readonly notifier: GameSessionNotifier,
  ) {}

  async execute(
    id: string,
    requesterId: string,
    delta: number,
  ): Promise<Character> {
    await requireEditableCharacter(
      this.characters,
      this.access,
      id,
      requesterId,
    );

    const { character, oldHp } = await this.characters.changeHp(id, delta);

    if (character.currentHp !== oldHp) {
      await this.notifier.notifyHpChanged(character.gameId, {
        characterId: character.id,
        oldHp,
        newHp: character.currentHp,
      });
    }

    return character;
  }
}
