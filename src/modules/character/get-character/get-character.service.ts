import { requireOwnedCharacter } from '../character.authorization.js';
import type { Character } from '../character.entity.js';
import type { CharacterRepository } from '../character.repository.js';

export class GetCharacterService {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(id: string, requesterId: string): Promise<Character> {
    return requireOwnedCharacter(this.characters, id, requesterId);
  }
}
