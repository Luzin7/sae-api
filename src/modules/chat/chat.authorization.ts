import type {
  CharacterAccess,
  CharacterSnapshot,
} from './character-access.contract.js';
import {
  ChatCharacterNotFoundError,
  ChatForbiddenError,
  ChatSessionNotFoundError,
  MasterOnlyError,
} from './chat.errors.js';
import type {
  ChatMessageRepository,
  ChatSessionRef,
} from './chat.repository.js';
import type {
  GameAccess,
  GameRef,
} from '@shared/game-access/game-access.contract.js';
import { requireGameParticipant } from '@shared/game-access/require-game-participant.js';

export async function requireChatSession(
  messages: ChatMessageRepository,
  sessionId: string,
): Promise<ChatSessionRef> {
  const session = await messages.findSession(sessionId);
  if (!session) throw new ChatSessionNotFoundError();

  return session;
}

/**
 * Master OR member may observe a session room; the branch itself lives in the
 * shared `requireGameParticipant` guard. Returns the game so callers can check
 * mastery.
 */
export async function requireChatMember(
  access: GameAccess,
  gameId: string,
  playerId: string,
): Promise<GameRef> {
  return requireGameParticipant({
    access,
    gameId,
    playerId,
    onMissing: () => new ChatForbiddenError(),
    onForbidden: () => new ChatForbiddenError(),
  });
}

/** Master-only actions fail here, after membership is already established. */
export function requireGameMaster(game: GameRef, playerId: string): void {
  if (game.masterId !== playerId) throw new MasterOnlyError();
}

/**
 * A character referenced by a frame must live in the same game as the session.
 * A missing character and a foreign one are indistinguishable (no existence
 * leak).
 */
export async function requireCharacterInGame(
  characters: CharacterAccess,
  gameId: string,
  characterId: string,
): Promise<CharacterSnapshot> {
  const character = await characters.findById(characterId);
  if (!character || character.gameId !== gameId) {
    throw new ChatCharacterNotFoundError();
  }

  return character;
}
