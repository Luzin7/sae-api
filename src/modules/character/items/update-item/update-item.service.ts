import {
  requireItemInCharacter,
  requireOwnedCharacter,
} from '../../character.authorization.js';
import type {
  CharacterItem,
  UpdateItemInput,
} from '../../character.entity.js';
import type { CharacterRepository } from '../../character.repository.js';

export class UpdateItemService {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(
    characterId: string,
    itemId: string,
    requesterId: string,
    input: UpdateItemInput,
  ): Promise<CharacterItem> {
    await requireOwnedCharacter(this.characters, characterId, requesterId);
    await requireItemInCharacter(this.characters, characterId, itemId);

    return this.characters.updateItem(itemId, input);
  }
}
