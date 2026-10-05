import { requireOwnedCharacter } from '../character.authorization.js';
import type { CharacterRepository } from '../character.repository.js';

export class DeleteCharacterService {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(id: string, requesterId: string): Promise<void> {
    await requireOwnedCharacter(this.characters, id, requesterId);

    await this.characters.delete(id);
  }
}
