import type { GameSessionNotifier } from '@shared/game-session/game-session-notifier.contract.js';
import { requireOwnedCharacter } from '../character.authorization.js';
import type { CharacterRepository } from '../character.repository.js';

export class DeleteCharacterService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly notifier: GameSessionNotifier,
  ) {}

  async execute(id: string, requesterId: string): Promise<void> {
    const character = await requireOwnedCharacter(
      this.characters,
      id,
      requesterId,
    );

    await this.characters.delete(id);
    await this.notifier.notifyRosterChanged(character.gameId);
  }
}
