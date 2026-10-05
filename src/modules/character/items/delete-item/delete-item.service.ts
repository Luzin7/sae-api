import {
  requireItemInCharacter,
  requireOwnedCharacter,
} from '../../character.authorization.js';
import type { CharacterRepository } from '../../character.repository.js';

export class DeleteItemService {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(
    characterId: string,
    itemId: string,
    requesterId: string,
  ): Promise<void> {
    await requireOwnedCharacter(this.characters, characterId, requesterId);
    await requireItemInCharacter(this.characters, characterId, itemId);

    await this.characters.deleteItem(itemId);
  }
}
