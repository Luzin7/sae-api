import { requireOwnedCharacter } from '../../character.authorization.js';
import type {
  CharacterItem,
  CreateItemInput,
} from '../../character.entity.js';
import type { CharacterRepository } from '../../character.repository.js';

export class AddItemService {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(
    characterId: string,
    requesterId: string,
    input: CreateItemInput,
  ): Promise<CharacterItem> {
    await requireOwnedCharacter(this.characters, characterId, requesterId);

    return this.characters.addItem(characterId, input);
  }
}
