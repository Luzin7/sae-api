import { ForbiddenError } from '@shared/errors/http-errors.js';
import { requireGameParticipant } from '@shared/game-access/require-game-participant.js';
import type { Game } from './game.entity.js';
import { GameNotFoundError } from './game.errors.js';
import type { GameRepository } from './game.repository.js';

/**
 * The master OR a member of the game may read/act on it. The branch itself
 * lives in the shared guard; this only binds the game error vocabulary.
 */
export async function requireMembership(
  repository: GameRepository,
  gameId: string,
  playerId: string,
): Promise<Game> {
  return requireGameParticipant({
    access: repository,
    gameId,
    playerId,
    onMissing: () => new GameNotFoundError(),
  });
}

/**
 * Only the game master may mutate or delete a game. A missing game and a
 * non-master requester both surface as domain errors from one place.
 */
export async function requireMaster(
  repository: GameRepository,
  gameId: string,
  playerId: string,
): Promise<Game> {
  const game = await repository.findById(gameId);
  if (!game) throw new GameNotFoundError();
  if (game.masterId !== playerId) throw new ForbiddenError();

  return game;
}
