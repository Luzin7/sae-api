import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { requireReadableCharacter } from '../character.authorization.js';
import type { CharacterRepository } from '../character.repository.js';
import { type CharacterView, withAdvancementOf } from '../character-view.js';

export class GetCharacterService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly access: GameAccess,
  ) {}

  async execute(id: string, requesterId: string): Promise<CharacterView> {
    const character = await requireReadableCharacter(
      this.characters,
      this.access,
      id,
      requesterId,
    );

    return withAdvancementOf(this.characters, character);
  }
}
