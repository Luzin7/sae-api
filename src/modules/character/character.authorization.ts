import { ForbiddenError } from '@shared/errors/http-errors.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { requireGameParticipant } from '@shared/game-access/require-game-participant.js';
import type { Character, CharacterItem } from './character.entity.js';
import {
  CharacterItemNotFoundError,
  CharacterNotFoundError,
} from './character.errors.js';
import type { CharacterRepository } from './character.repository.js';

export async function requireOwnedCharacter(
  repository: CharacterRepository,
  id: string,
  requesterId: string,
): Promise<Character> {
  const character = await repository.findById(id);
  if (!character) throw new CharacterNotFoundError();
  if (character.playerId !== requesterId) throw new ForbiddenError();

  return character;
}

/**
 * Read guard: the owner and the game master may read a character sheet.
 * Mutations keep using the write guards below.
 */
export async function requireReadableCharacter(
  repository: CharacterRepository,
  access: GameAccess,
  id: string,
  requesterId: string,
): Promise<Character> {
  const character = await repository.findById(id);
  if (!character) throw new CharacterNotFoundError();
  if (character.playerId === requesterId) return character;

  const game = await access.findById(character.gameId);
  if (game?.masterId === requesterId) return character;

  throw new ForbiddenError();
}

export async function requireEditableCharacter(
  repository: CharacterRepository,
  access: GameAccess,
  id: string,
  requesterId: string,
): Promise<{ character: Character; isMaster: boolean }> {
  const character = await repository.findById(id);
  if (!character) throw new CharacterNotFoundError();

  const game = await access.findById(character.gameId);
  const isMaster = game?.masterId === requesterId;
  if (requesterId !== character.playerId && !isMaster)
    throw new ForbiddenError();

  return { character, isMaster };
}

/**
 * Membership guard for creating a character: the player must be the game
 * master OR a member, otherwise the game id must not leak existence. Missing
 * and non-member both surface as Forbidden (no existence leak).
 */
export async function requireMembership(
  access: GameAccess,
  gameId: string,
  playerId: string,
): Promise<void> {
  await requireGameParticipant({ access, gameId, playerId });
}

/**
 * IDOR guard for sub-resources: the item id from the URL must belong to the
 * character id from the URL, never to another character.
 */
export async function requireItemInCharacter(
  repository: CharacterRepository,
  characterId: string,
  itemId: string,
): Promise<CharacterItem> {
  const item = await repository.findItemById(itemId);
  if (!item) throw new CharacterItemNotFoundError();
  if (item.characterId !== characterId) throw new ForbiddenError();

  return item;
}
