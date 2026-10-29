import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import {
  requireMembership,
  requireReadableCharacter,
} from './character.authorization.js';
import {
  type CharacterItem,
  type CharacterSkillDetail,
  DEFAULT_CHARACTER_PAGE,
  type Page,
} from './character.entity.js';
import type { CharacterRepository } from './character.repository.js';
import { type CharacterView, withAdvancement } from './character-view.js';

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
  ): Promise<CharacterView[]> {
    return withAdvancement(
      this.characters,
      await this.characters.findByPlayer(playerId, page),
    );
  }

  async listByGame(
    gameId: string,
    requesterId: string,
  ): Promise<CharacterView[]> {
    await requireMembership(this.membership, gameId, requesterId);

    return withAdvancement(
      this.characters,
      await this.characters.findByGame(gameId),
    );
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
