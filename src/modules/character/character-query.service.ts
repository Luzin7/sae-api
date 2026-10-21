import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import {
  requireMembership,
  requireReadableCharacter,
} from './character.authorization.js';
import {
  type Character,
  type CharacterItem,
  type CharacterSkillDetail,
  DEFAULT_CHARACTER_PAGE,
  type Page,
} from './character.entity.js';
import type { CharacterRepository } from './character.repository.js';

/**
 * Read-only operations. No orchestration beyond the ownership/membership
 * guards, so they live as methods instead of empty classes.
 */
export class CharacterQueryService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly membership: GameAccess,
  ) {}

  async listMine(
    playerId: string,
    page: Page = DEFAULT_CHARACTER_PAGE,
  ): Promise<Character[]> {
    return this.characters.findByPlayer(playerId, page);
  }

  async listByGame(gameId: string, requesterId: string): Promise<Character[]> {
    await requireMembership(this.membership, gameId, requesterId);

    return this.characters.findByGame(gameId);
  }

  async listItems(
    characterId: string,
    requesterId: string,
  ): Promise<CharacterItem[]> {
    await requireReadableCharacter(
      this.characters,
      this.membership,
      characterId,
      requesterId,
    );

    return this.characters.findItems(characterId);
  }

  async listSkills(
    characterId: string,
    requesterId: string,
  ): Promise<CharacterSkillDetail[]> {
    await requireReadableCharacter(
      this.characters,
      this.membership,
      characterId,
      requesterId,
    );

    return this.characters.findSkillDetails(characterId);
  }
}
