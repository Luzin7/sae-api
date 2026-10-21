import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { requireReadableCharacter } from '../character.authorization.js';
import type { Character } from '../character.entity.js';
import type { CharacterRepository } from '../character.repository.js';

export class GetCharacterService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly access: GameAccess,
  ) {}

  async execute(id: string, requesterId: string): Promise<Character> {
    return requireReadableCharacter(
      this.characters,
      this.access,
      id,
      requesterId,
    );
  }
}
