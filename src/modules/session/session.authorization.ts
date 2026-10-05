import { ForbiddenError } from '@shared/errors/http-errors.js';
import type {
  GameAccess,
  GameRef,
} from '@shared/game-access/game-access.contract.js';
import { requireGameParticipant } from '@shared/game-access/require-game-participant.js';
import type { GameSession } from './session.entity.js';
import { SessionNotFoundError } from './session.errors.js';
import type { SessionRepository } from './session.repository.js';

/**
 * Only the game master may start or end a session. A missing game and a
 * non-master requester are indistinguishable on purpose (no existence leak).
 */
export async function requireMaster(
  access: GameAccess,
  gameId: string,
  playerId: string,
): Promise<GameRef> {
  const game = await access.findById(gameId);
  if (!game || game.masterId !== playerId) throw new ForbiddenError();

  return game;
}

/**
 * The master OR a member of the game may observe a session. The branch itself
 * lives in the shared guard; missing and non-member both surface as Forbidden.
 */
export async function requireParticipant(
  access: GameAccess,
  gameId: string,
  playerId: string,
): Promise<GameRef> {
  return requireGameParticipant({ access, gameId, playerId });
}

/**
 * P0 IDOR guard: a session id taken from the URL must belong to the path's
 * game. Without this, any authenticated player can read any session's logs.
 */
export async function requireSessionInGame(
  repository: SessionRepository,
  gameId: string,
  sessionId: string,
): Promise<GameSession> {
  const session = await repository.findById(sessionId);
  if (!session) throw new SessionNotFoundError();
  if (session.gameId !== gameId) throw new ForbiddenError();

  return session;
}
